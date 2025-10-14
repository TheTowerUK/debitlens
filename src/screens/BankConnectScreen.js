// src/screens/BankConnectScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { usePlaidLink } from 'react-native-plaid-link-sdk';
import { useApp } from '../state/AppState';
import * as Plaid from 'react-native-plaid-link-sdk';
console.log('[Plaid keys]', Object.keys(Plaid)); // should include usePlaidLink or PlaidLink

const BACKEND = 'http://192.168.178.94:4000'; // e.g., http://192.168.1.23:4000;

export default function BankConnectScreen({ navigation }) {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const accounts = state?.accounts || [];

  const [linkToken, setLinkToken] = useState(null);
  const [busy, setBusy] = useState(false);

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

  const { open, ready } = usePlaidLink({
    token: linkToken || '',
    onSuccess: async (success) => {
      try {
        setBusy(true);
        const pub = success?.publicToken;
        const r = await fetch(`${BACKEND}/api/exchange_public_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: pub }),
        });
        const j = await r.json();
        if (!j.ok) throw new Error('exchange failed');

        // Now pull transactions from backend and merge locally
        const syncRes = await fetch(`${BACKEND}/api/transactions/sync`);
        const data = await syncRes.json();

        // Map provider accounts to local accounts (by name). Create missing ones.
        const byName = {};
        for (const a of accounts) byName[String(a.name).toLowerCase()] = String(a.id);

        for (const t of data.transactions || []) {
          // resolve accountId
          const key = String(t.accountName || 'Bank').toLowerCase();
          let accountId = byName[key];
          if (!accountId) {
            const created = await actions.addAccount(t.accountName || 'Bank', 'current');
            accountId = String(created.id);
            byName[key] = accountId;
          }

          // dedupe: skip if we already imported this providerId
          const already = (state.transactions || []).some(x => x.note?.includes(t.providerId));
          if (already) continue;

          await actions.addTransaction({
            accountId,
            type: t.type,
            amount: t.amount,
            date: t.date,
            category: t.category || (t.type === 'income' ? 'Income' : 'General'),
            // keep providerId in note for simple dedupe; in prod, keep a separate field
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
    },
    onExit: (exit) => {
      console.log('Link exit', exit);
    },
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Connect a bank</Text>
      <Text style={styles.subtle}>Use Plaid to securely link your bank and import transactions.</Text>

      <View style={styles.card}>
        <Pressable
          style={[styles.btn, (!ready || !linkToken || busy) ? styles.btnDisabled : styles.btnSave]}
          disabled={!ready || !linkToken || busy}
          onPress={() => open()}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Open Plaid Link</Text>}
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
          onPress={fetchLinkToken}
        >
          <Text style={styles.btnText}>Refresh Link Token</Text>
        </Pressable>
      </View>

      <Text style={[styles.subtle, { marginTop: 8 }]}>
        Requires a development build (not Expo Go).
      </Text>
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
