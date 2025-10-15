// src/screens/BankConnectScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useApp } from '../state/AppState';
import * as PlaidSDK from 'react-native-plaid-link-sdk'; // import namespace to detect available exports

const BACKEND = 'http://YOUR-LAN-IP:4000'; // change to your LAN IP

export default function BankConnectScreen({ navigation }) {
  const { state, actions } = useApp();
  const accounts = state?.accounts || [];

  const [linkToken, setLinkToken] = useState(null);
  const [busy, setBusy] = useState(false);

  const hasHook = typeof PlaidSDK.usePlaidLink === 'function';
  const hasComponent = typeof PlaidSDK.PlaidLink !== 'undefined';

  const fetchLinkToken = async () => {
    try {
      setBusy(true);
      const r = await fetch(`${BACKEND}/api/create_link_token`, { method: 'POST' });
      const j = await r.json();
      if (!j.link_token) throw new Error('No link_token');
      setLinkToken(j.link_token);
    } catch (e) {
      console.warn('link_token failed', e);
      Alert.alert('Error', 'Could not create link session.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchLinkToken();
  }, []);

  // Shared success handler
  const onSuccess = async (publicToken) => {
    try {
      setBusy(true);
      const r = await fetch(`${BACKEND}/api/exchange_public_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error('exchange failed');

      const syncRes = await fetch(`${BACKEND}/api/transactions/sync`);
      const data = await syncRes.json();

      // Map accounts & import
      const byName = {};
      for (const a of accounts) byName[String(a.name).toLowerCase()] = String(a.id);

      for (const t of data.transactions || []) {
        const key = String(t.accountName || 'Bank').toLowerCase();
        let accountId = byName[key];
        if (!accountId) {
          const created = await actions.addAccount(t.accountName || 'Bank', 'current');
          accountId = String(created.id);
          byName[key] = accountId;
        }
        // naive dedupe using providerId in note
        const already = (state.transactions || []).some(x => x.note?.includes(t.providerId));
        if (already) continue;

        await actions.addTransaction({
          accountId,
          type: t.type,
          amount: t.amount,
          date: t.date,
          category: t.category || (t.type === 'income' ? 'Income' : 'General'),
          note: (t.note ? `${t.note} · ` : '') + `(${t.providerId})`,
        });
      }
      Alert.alert('Linked!', 'Bank connected and transactions synced.');
      navigation.goBack();
    } catch (e) {
      console.warn('exchange/sync failed', e);
      Alert.alert('Sync failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Hook-based flow (preferred on v12+)
  const linkProps = useMemo(() => ({
    token: linkToken || '',
    onSuccess: (success) => onSuccess(success.publicToken),
    onExit: (exit) => console.log('Link exit', exit),
  }), [linkToken]);

  const hook = hasHook ? PlaidSDK.usePlaidLink(linkProps) : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Connect a bank</Text>
      <Text style={styles.subtle}>Plaid Link requires a development build (not Expo Go).</Text>

      <View style={styles.card}>
        {/* Hook path */}
        {hasHook && (
          <Pressable
            style={[styles.btn, (!hook?.ready || !linkToken || busy) ? styles.btnDisabled : styles.btnSave]}
            disabled={!hook?.ready || !linkToken || busy}
            onPress={() => hook.open()}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Open Plaid Link</Text>}
          </Pressable>
        )}

        {/* Component path (fallback) */}
        {!hasHook && hasComponent && linkToken && (
          <PlaidSDK.PlaidLink
            tokenConfig={{ token: linkToken }}
            onSuccess={(success) => onSuccess(success.publicToken)}
            onExit={(exit) => console.log('Link exit', exit)}
          >
            <View style={[styles.btn, styles.btnSave]}>
              <Text style={styles.btnText}>Open Plaid Link</Text>
            </View>
          </PlaidSDK.PlaidLink>
        )}

        {/* If neither API is present, you’re in Expo Go or the SDK didn’t link */}
        {!hasHook && !hasComponent && (
          <View style={[styles.btn, styles.btnDisabled]}>
            <Text style={styles.btnText}>Plaid SDK not available (Use dev build)</Text>
          </View>
        )}

        <Pressable style={[styles.btn, styles.btnGhost, { marginTop: 8 }]} onPress={fetchLinkToken}>
          <Text style={styles.btnText}>Refresh Link Token</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginTop: 12 },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: '#1F2937' },
  btnDisabled: { backgroundColor: '#374151' },
  btnText: { color: '#fff', fontWeight: '700' },
});
