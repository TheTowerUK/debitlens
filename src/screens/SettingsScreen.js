// src/screens/SettingsScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useApp } from '../state/AppState';

const CURRENCIES = ['GBP', 'USD', 'EUR', 'JPY', 'AUD', 'CAD', 'NZD', 'INR'];

// Simple CSV template users can download
const CSV_TEMPLATE = `date,amount,type,account,category,note
2025-10-01,12.50,expense,Main,Groceries,Milk & bread
2025-10-03,2500,income,Main,Salary,October
`;

export default function SettingsScreen({ navigation }) {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const [busy, setBusy] = useState(false);

  const currency = prefs.currency || 'GBP';
  const totals = useMemo(() => {
    const txns = state?.transactions || [];
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = txns.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [state?.transactions]);

  const setCurrency = async (code) => {
    try {
      await actions.setPrefs({ ...(state?.prefs || {}), currency: code });
      Alert.alert('Currency updated', `Currency set to ${code}.`);
    } catch (e) {
      console.warn('[settings] set currency failed', e);
      Alert.alert('Error', 'Could not update currency.');
    }
  };

  const exportData = async () => {
    try {
      setBusy(true);
      const payload = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        prefs: state?.prefs || {},
        accounts: state?.accounts || [],
        transactions: state?.transactions || [],
        budgets: state?.budgets || [],
        recurring: state?.recurring || [],
      };
      const path = FileSystem.cacheDirectory + 'debitlens_export.json';
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'Export data',
      });
    } catch (e) {
      console.warn('[settings] export failed', e);
      Alert.alert('Export failed', 'Could not export your data.');
    } finally {
      setBusy(false);
    }
  };

  const exportTemplate = async () => {
    try {
      const path = FileSystem.cacheDirectory + 'debitlens_template.csv';
      await FileSystem.writeAsStringAsync(path, CSV_TEMPLATE, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'CSV template',
      });
    } catch (e) {
      console.warn('[settings] template export failed', e);
      Alert.alert('Error', 'Could not export the template.');
    }
  };

  const clearAll = async () => {
    Alert.alert('Reset app?', 'This will remove all accounts, transactions, budgets and schedules on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await actions.resetAll();
            Alert.alert('Done', 'All local data was cleared.');
          } catch (e) {
            console.warn('[settings] reset failed', e);
            Alert.alert('Error', 'Could not clear data.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.subtle}>App preferences & data tools</Text>

      {/* Currency */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Currency</Text>
        <View style={styles.rowWrap}>
          {CURRENCIES.map(code => (
            <Pressable
              key={code}
              onPress={() => setCurrency(code)}
              style={[styles.pill, currency === code && styles.pillActive]}
            >
              <Text style={[styles.pillText, currency === code && styles.pillTextActive]}>{code}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Data tools */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Data</Text>

        <Pressable style={[styles.btn, styles.btnSave]} onPress={exportData} disabled={busy}>
          <Text style={styles.btnText}>{busy ? 'Working…' : 'Export data (JSON)'}</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.btnGhost, { marginTop: 8 }]} onPress={exportTemplate}>
          <Text style={styles.btnText}>Export CSV template</Text>
        </Pressable>
console.log('routes:', navigation.getState()?.routeNames);

        <Pressable
          style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
          onPress={() => navigation.navigate('ImportCSV')}
        ><Text style={styles.btnText}>Import from CSV</Text>
        </Pressable>
      </View>

      {/* Totals (read-only) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.kv}>Transactions: <Text style={styles.kvValue}>{(state?.transactions || []).length}</Text></Text>
        <Text style={styles.kv}>Accounts: <Text style={styles.kvValue}>{(state?.accounts || []).length}</Text></Text>
        <Text style={styles.kv}>Income (sum): <Text style={[styles.kvValue, styles.green]}>{totals.income.toFixed(2)}</Text></Text>
        <Text style={styles.kv}>Expense (sum): <Text style={[styles.kvValue, styles.red]}>{totals.expense.toFixed(2)}</Text></Text>
        <Text style={styles.kv}>Net: <Text style={[styles.kvValue, totals.net >= 0 ? styles.green : styles.red]}>{totals.net.toFixed(2)}</Text></Text>
      </View>

      {/* Danger */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Danger zone</Text>
        <Pressable style={[styles.btn, styles.btnDanger]} onPress={clearAll}>
          <Text style={styles.btnText}>Clear all local data</Text>
        </Pressable>
        <Text style={[styles.subtle, { marginTop: 8 }]}>
          This removes data only on this device. It cannot be undone.
        </Text>
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

  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },

  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -8, marginBottom: -8 },
  pill: {
    backgroundColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#E5E7EB', fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: '#1F2937' },
  btnDanger: { backgroundColor: '#7F1D1D' },
  btnText: { color: '#fff', fontWeight: '700' },

  kv: { color: '#9CA3AF', marginTop: 4 },
  kvValue: { color: '#E5E7EB', fontWeight: '700' },
  red: { color: '#F87171' },
  green: { color: '#34D399' },
});
