// src/screens/ImportCsvScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, Platform, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseCSV, toISODate } from '../utils/csv';
import { useApp } from '../state/AppState';

const KNOWN = ['date', 'amount', 'type', 'account', 'category', 'note'];

export default function ImportCsvScreen({ navigation }) {
  const { state, actions } = useApp();
  const accounts = state?.accounts ?? [];

  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [map, setMap] = useState({ date: '', amount: '', type: '', account: '', category: '', note: '' });
  const [createAccounts, setCreateAccounts] = useState(true);
  const [defaultType, setDefaultType] = useState('expense'); // fallback if column missing

  const headerOptions = useMemo(() => ['(ignore)', ...headers], [headers]);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const { headers: h, rows: r } = parseCSV(text);

      if (!h.length || !r.length) {
        Alert.alert('Invalid CSV', 'No data detected.');
        return;
      }

      // try auto-map by name
      const lower = h.map((x) => x.toLowerCase());
      const auto = {};
      for (const k of KNOWN) {
        const i = lower.indexOf(k);
        auto[k] = i >= 0 ? h[i] : '';
      }

      setFileName(asset.name || 'import.csv');
      setHeaders(h);
      setRows(r);
      setMap(auto);
    } catch (e) {
      console.warn('[csv] pick failed', e);
      Alert.alert('Pick failed', 'Could not read the CSV file.');
    }
  };

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  const asTxn = (row) => {
    // build object using header mapping
    const get = (target) => {
      const col = map[target];
      if (!col) return '';
      const idx = headers.indexOf(col);
      return idx >= 0 ? String(row[idx] ?? '').trim() : '';
    };
    const rawDate = get('date');
    const rawAmount = get('amount');
    const rawType = (get('type') || defaultType).toLowerCase();
    const rawAccount = get('account') || '';
    const rawCategory = get('category') || '';
    const rawNote = get('note') || '';

    const date = toISODate(rawDate);
    const amount = Number(String(rawAmount).replace(/,/g, ''));
    const type = rawType === 'income' ? 'income' : 'expense';

    return {
      date,
      amount: Number.isFinite(amount) ? amount : 0,
      type,
      accountName: rawAccount,
      category: rawCategory,
      note: rawNote,
    };
  };

  const importNow = async () => {
    if (!rows.length) return Alert.alert('Nothing to import', 'Pick a CSV first.');
    if (!map.date || !map.amount) {
      return Alert.alert('Map required', 'Map at least Date and Amount columns.');
    }

    // Build existing accounts map (name -> id)
    const byName = {};
    for (const a of accounts) byName[String(a.name).toLowerCase()] = String(a.id);

    // We’ll import line-by-line to use existing addTransaction logic (alerts, persistence, etc.)
    let imported = 0;
    try {
      for (const row of rows) {
        const tx = asTxn(row);
        if (!tx.date || !Number.isFinite(tx.amount) || tx.amount <= 0) continue;

        // resolve accountId
        let accountId = null;
        if (tx.accountName) {
          const key = tx.accountName.toLowerCase();
          if (byName[key]) {
            accountId = byName[key];
          } else if (createAccounts) {
            const created = await actions.addAccount(tx.accountName, 'current');
            byName[key] = String(created.id);
            accountId = String(created.id);
          }
        }
        // default to first account if none available
        if (!accountId && accounts[0]) accountId = String(accounts[0].id);
        if (!accountId) continue; // still none? skip

        await actions.addTransaction({
          accountId,
          type: tx.type,
          amount: tx.amount,
          date: tx.date,
          category: tx.category || (tx.type === 'expense' ? 'General' : 'Income'),
          note: tx.note || `Imported (${fileName})`,
        });
        imported++;
      }
      Alert.alert('Import complete', `Imported ${imported} transaction${imported === 1 ? '' : 's'}.`);
      navigation.navigate('History');
    } catch (e) {
      console.warn('[csv] import failed', e);
      Alert.alert('Import failed', 'Please check the CSV formatting and mappings.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Import CSV</Text>
      <Text style={styles.subtle}>date, amount, type, account, category, note</Text>

      <View style={styles.card}>
        <Pressable style={[styles.btn, styles.btnSave]} onPress={pickFile}>
          <Text style={styles.btnText}>{fileName ? 'Choose another file' : 'Choose CSV file'}</Text>
        </Pressable>
        {!!fileName && (
          <Text style={[styles.subtle, { marginTop: 8 }]} numberOfLines={1} ellipsizeMode="tail">
            Selected: {fileName}
          </Text>
        )}
      </View>

      {!!headers.length && (
        <View style={styles.card}>
          <Text style={styles.label}>Map columns</Text>

          {KNOWN.map((k) => (
            <View key={k} style={styles.mapRow}>
              <Text style={styles.mapKey}>{k}</Text>
              <TextInput
                value={map[k]}
                onChangeText={(v) => setMap((m) => ({ ...m, [k]: v }))}
                placeholder="Select or type exact header"
                placeholderTextColor="#6B7280"
                style={[styles.input, { flex: 1 }]}
                autoCapitalize="none"
              />
            </View>
          ))}

          {/* Defaults */}
          {!map.type && (
            <View style={styles.mapRow}>
              <Text style={styles.mapKey}>default type</Text>
              <View style={{ flexDirection: 'row' }}>
                {['expense', 'income'].map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.pill, defaultType === t && styles.pillActive, { marginRight: 8 }]}
                    onPress={() => setDefaultType(t)}
                  >
                    <Text style={[styles.pillText, defaultType === t && styles.pillTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.mapRow}>
            <Text style={styles.mapKey}>auto-create accounts</Text>
            <Pressable
              style={[styles.pill, createAccounts && styles.pillActive]}
              onPress={() => setCreateAccounts((v) => !v)}
            >
              <Text style={[styles.pillText, createAccounts && styles.pillTextActive]}>
                {createAccounts ? 'On' : 'Off'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Preview */}
      {!!preview.length && (
        <View style={styles.card}>
          <Text style={styles.label}>Preview (first 5)</Text>
          <FlatList
            data={preview}
            keyExtractor={(_, i) => String(i)}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            renderItem={({ item }) => (
              <Text style={styles.previewText} numberOfLines={1} ellipsizeMode="tail">
                {item.join(' | ')}
              </Text>
            )}
          />
        </View>
      )}

      {/* Import */}
      {!!rows.length && (
        <Pressable style={[styles.btn, styles.btnSave]} onPress={importNow}>
          <Text style={styles.btnText}>Import {rows.length} row{rows.length === 1 ? '' : 's'}</Text>
        </Pressable>
      )}
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
  label: { color: '#E5E7EB', fontWeight: '800', marginBottom: 8 },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginTop: 12 },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },

  mapRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  mapKey: { color: '#9CA3AF', width: 120 },

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
  btnText: { color: '#fff', fontWeight: '700' },

  previewText: { color: '#E5E7EB' },
});
