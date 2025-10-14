// src/screens/SettingsScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy'; // use legacy to avoid SDK 54 deprecation warning
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

const CURRENCIES = ['GBP', 'USD', 'EUR', 'JPY', 'AUD', 'CAD', 'NZD', 'INR'];
const SYMBOLS = {
  GBP: '£', USD: '$', EUR: '€', JPY: '¥',
  AUD: 'A$', CAD: 'C$', NZD: 'NZ$', INR: '₹',
};
const symFor = (code) => SYMBOLS[code] || code;

export default function SettingsScreen({ navigation }) {
  const { state, actions } = useApp();

  // prefs -> local form
  const base = state?.prefs || {};
  const [currency, setCurrency] = useState(base.currency || 'GBP');
  const [currencySymbol, setCurrencySymbol] = useState(base.currencySymbol || symFor(currency));
  const [rollover, setRollover] = useState(!!base.budgetRollover);

  // quick preview using current prefs
  const preview = useMemo(() => money(1234.56, { currency, currencySymbol }), [currency, currencySymbol]);

  const onSavePrefs = async () => {
    try {
      await actions.updatePrefs({
        currency,
        currencySymbol: currencySymbol || symFor(currency),
        budgetRollover: !!rollover,
      });
      Alert.alert('Saved', 'Preferences updated.');
    } catch (e) {
      console.warn('[settings] save prefs failed', e);
      Alert.alert('Save failed', 'Please try again.');
    }
  };

  const onExport = async () => {
    try {
      // Export the *current state object* (what we persist)
      const data = JSON.stringify(state, null, 2);
      const name = `base44-backup-${new Date().toISOString().slice(0,10)}.json`;
      const uri = `${FileSystem.cacheDirectory}${name}`;

      await FileSystem.writeAsStringAsync(uri, data, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Share backup JSON' });
      } else {
        Alert.alert('Exported', `Saved to: ${uri}`);
      }
    } catch (e) {
      console.warn('[settings] export failed', e);
      Alert.alert('Export failed', 'Could not create the backup file.');
    }
  };

  const onImport = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const asset = picked.assets?.[0];
      if (!asset?.uri) return;

      const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(raw);

      // Very light validation
      const nextAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
      const nextTxns     = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      const nextBudgets  = Array.isArray(parsed.budgets) ? parsed.budgets : [];
      const nextRecur    = Array.isArray(parsed.recurring) ? parsed.recurring : [];
      const nextPrefs    = typeof parsed.prefs === 'object' && parsed.prefs ? parsed.prefs : {};

      // Apply via actions (each action persists)
      await actions.setAccounts(nextAccounts);
      await actions.setTransactions(nextTxns);
      await actions.setBudgets(nextBudgets);
      await actions.setRecurring(nextRecur);
      await actions.updatePrefs(nextPrefs);

      Alert.alert('Imported', 'Backup restored successfully.');
      navigation.navigate('Dashboard');
    } catch (e) {
      console.warn('[settings] import failed', e);
      Alert.alert('Import failed', 'Ensure the file is a valid backup JSON.');
    }
  };

  const onReset = async () => {
    Alert.alert('Reset all data?', 'This will clear your accounts, transactions, budgets and prefs back to demo defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            // Minimal reset: set empty arrays + basic prefs; app seeds a default account/txn on next launch if needed
            await actions.setAccounts([]);
            await actions.setTransactions([]);
            await actions.setBudgets([]);
            await actions.setRecurring([]);
            await actions.updatePrefs({ currency: 'GBP', currencySymbol: '£', budgetRollover: true });
            Alert.alert('Reset complete', 'Data cleared to defaults.');
            navigation.navigate('Dashboard');
          } catch (e) {
            console.warn('[settings] reset failed', e);
            Alert.alert('Reset failed', 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.subtle}>App preferences, backup & restore</Text>

      {/* Currency */}
      <View style={styles.card}>
        <Text style={styles.label}>Currency</Text>
        <View style={[styles.row, { flexWrap: 'wrap', marginTop: 6, marginRight: -8, marginBottom: -8 }]}>
          {CURRENCIES.map((code) => (
            <Pressable
              key={code}
              style={[styles.pill, currency === code && styles.pillActive, { marginRight: 8, marginBottom: 8 }]}
              onPress={() => {
                setCurrency(code);
                if (!currencySymbol || currencySymbol === symFor(currency)) {
                  setCurrencySymbol(symFor(code));
                }
              }}
            >
              <Text style={[styles.pillText, currency === code && styles.pillTextActive]}>
                {code} ({symFor(code)})
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.subtle, { marginTop: 10 }]}>Symbol override</Text>
        <TextInput
          value={currencySymbol}
          onChangeText={setCurrencySymbol}
          placeholder={symFor(currency)}
          placeholderTextColor="#6B7280"
          style={[styles.input, { marginTop: 6 }]}
        />

        <Text style={[styles.subtle, { marginTop: 10 }]}>Preview</Text>
        <Text style={styles.preview}>{preview}</Text>
      </View>

      {/* Rollover */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Rollover unused budget</Text>
          <Switch
            value={rollover}
            onValueChange={setRollover}
            trackColor={{ false: '#374151', true: '#2563EB' }}
            thumbColor="#fff"
          />
        </View>
        <Text style={[styles.subtle, { marginTop: 6 }]}>
          When enabled, any remaining amount from last month’s budget is added to this month.
        </Text>
      </View>

      {/* Save prefs */}
      <View style={styles.row} >
        <Pressable style={[styles.btn, styles.btnSave]} onPress={onSavePrefs}>
          <Text style={styles.btnText}>Save Preferences</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => navigation.navigate('ImportCsv')}>
        <Text style={styles.btnText}>Import transactions (CSV)</Text>
      </Pressable>

      <Pressable style={[styles.btn, styles.btnSave]} onPress={() => navigation.navigate('BankConnect')}>
        <Text style={styles.btnText}>Connect a bank (beta)</Text>
      </Pressable>

      {/* Backup / Restore */}
      <View style={styles.card}>
        <Text style={styles.label}>Backup & Restore</Text>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Pressable style={[styles.btn, styles.btnGhost, { marginRight: 8 }]} onPress={onExport}>
            <Text style={styles.btnText}>Export backup (JSON)</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={onImport}>
            <Text style={styles.btnText}>Import backup (JSON)</Text>
          </Pressable>
        </View>
        <Pressable style={[styles.btn, styles.btnDanger, { marginTop: 10 }]} onPress={onReset}>
          <Text style={styles.btnText}>Reset demo data</Text>
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
  label: { color: '#E5E7EB', fontWeight: '800' },
  preview: { color: '#E5E7EB', fontWeight: '800', marginTop: 4 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },

  pill: {
    backgroundColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#E5E7EB', fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: '#1F2937' },
  btnDanger: { backgroundColor: '#7F1D1D' },
  btnText: { color: '#fff', fontWeight: '700' },
});
