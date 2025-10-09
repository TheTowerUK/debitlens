// src/screens/SettingsScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useApp } from '../state/AppState';
import { getCurrencyFromPrefs } from '../utils/money';

const CURRENCIES = ['GBP', 'USD', 'EUR', 'JPY', 'AUD', 'CAD', 'NZD', 'INR'];

export default function SettingsScreen() {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const [useBio, setUseBio] = useState(!!prefs.useBiometrics);
  const [themeDark, setThemeDark] = useState((prefs.theme || 'dark') === 'dark');
  const [currencyCode, setCurrencyCode] = useState(String(prefs.currencyCode || 'GBP').toUpperCase());

  const { symbol } = getCurrencyFromPrefs({ currencyCode });

  const filePrefix = useMemo(() => {
    const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
    return `base44-backup-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }, []);

  const onSavePrefs = async () => {
    await actions.updatePrefs({
      useBiometrics: useBio,
      theme: themeDark ? 'dark' : 'light',
      currencyCode,
    });
    Alert.alert('Saved', 'Preferences updated.');
  };

  const onExport = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        data: {
          accounts: state.accounts || [],
          transactions: state.transactions || [],
          prefs: state.prefs || {},
          lastSync: state.lastSync || null,
        },
      };
      const json = JSON.stringify(payload, null, 2);
      const uri = FileSystem.cacheDirectory + `${filePrefix}.json`;
      await FileSystem.writeAsStringAsync(uri, json);


      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Base44 data', UTI: 'public.json' });
      } else {
        Alert.alert('Exported', `Saved to cache:\n${uri}`);
      }
    } catch (e) {
      console.warn('[settings] export failed', e);
      Alert.alert('Export failed', String(e?.message || e));
    }
  };

  const onImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', multiple: false, copyToCacheDirectory: true });
      const cancelled = res.canceled || res.type === 'cancel';
      if (cancelled) return;
      const asset = res.assets ? res.assets[0] : res;
      const uri = asset?.uri;
      if (!uri) return Alert.alert('Import', 'No file selected.');

      const text = await FileSystem.readAsStringAsync(uri);
      let parsed;
      try { parsed = JSON.parse(text); } catch { return Alert.alert('Import failed', 'Selected file is not valid JSON.'); }
      if (!parsed?.data) return Alert.alert('Import failed', 'File format not recognized.');

      const { accounts = [], transactions = [], prefs: importedPrefs = {}, lastSync = null } = parsed.data;
      Alert.alert(
        'Restore data?',
        `Accounts: ${accounts.length}\nTransactions: ${transactions.length}\nThis will replace current data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore', style: 'destructive', onPress: async () => {
              await actions.setAccounts(accounts);
              await actions.setTransactions(transactions);
              if (importedPrefs && typeof importedPrefs === 'object') {
                await actions.updatePrefs(importedPrefs);
              }
              Alert.alert('Restored', 'Data import complete.');
            }
          }
        ]
      );
    } catch (e) {
      console.warn('[settings] import failed', e);
      Alert.alert('Import failed', String(e?.message || e));
    }
  };

  const onClearAll = async () => {
    Alert.alert(
      'Delete ALL data?',
      'This removes all accounts and transactions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await actions.setAccounts([]);
            await actions.setTransactions([]);
            await actions.updatePrefs({ ...prefs, theme: 'dark', useBiometrics: false });
            Alert.alert('Cleared', 'All local data removed.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.subtle}>Preferences & Data</Text>

      {/* Prefs */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Use Face/Touch ID</Text>
          <Switch value={useBio} onValueChange={setUseBio} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Dark theme</Text>
          <Switch value={themeDark} onValueChange={setThemeDark} />
        </View>

        {/* Currency */}
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={styles.label}>Currency</Text>
          <View style={{ flexDirection: 'row' }}>
            <Text style={[styles.label, { marginRight: 8 }]}>{symbol}</Text>
            <Text style={[styles.subtle, { marginRight: 12 }]}>{currencyCode}</Text>
            <Pressable
              style={styles.btnTiny}
              onPress={() => {
                const idx = CURRENCIES.indexOf(currencyCode);
                const next = idx === -1 || idx === CURRENCIES.length - 1 ? CURRENCIES[0] : CURRENCIES[idx + 1];
                setCurrencyCode(next);
              }}
            >
              <Text style={styles.btnTinyText}>Change</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={[styles.btnSave, { marginTop: 12 }]} onPress={onSavePrefs}>
          <Text style={styles.btnText}>Save Preferences</Text>
        </Pressable>
      </View>

      {/* Backup / Restore */}
      <View style={styles.card}>
        <Text style={styles.label}>Data Backup</Text>
        <View style={{ height: 8 }} />
        <Pressable style={styles.btnSave} onPress={onExport}>
          <Text style={styles.btnText}>Export JSON</Text>
        </Pressable>
        <View style={{ height: 8 }} />
        <Pressable style={styles.btnSecondary} onPress={onImport}>
          <Text style={styles.btnText}>Import JSON</Text>
        </Pressable>
      </View>

      {/* Danger zone */}
      <View style={styles.cardDanger}>
        <Text style={styles.label}>Danger Zone</Text>
        <View style={{ height: 8 }} />
        <Pressable style={styles.btnDanger} onPress={onClearAll}>
          <Text style={styles.btnText}>Clear All Data</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16, paddingTop: Platform.OS === 'ios' ? 44 : 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardDanger: { backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 12 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },

  label: { color: '#E5E7EB', fontWeight: '700' },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#6B7280', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnDanger: { backgroundColor: '#B91C1C', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },

  btnTiny: { backgroundColor: '#1F2937', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  btnTinyText: { color: '#fff', fontWeight: '700' },
});
