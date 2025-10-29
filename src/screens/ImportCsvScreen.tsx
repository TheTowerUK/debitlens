// src/screens/ImportCsvScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../state/AppState';
import { parseCSV, toISODate, rowHash } from '../utils/csvUtils';
import { CSV_TEMPLATE } from '../utils/csvTemplate';
import { money } from '../utils/moneyUtils';
import { todayISO } from '../utils/dateUtils';

export default function ImportCsvScreen({ navigation }) {
  const { actions, state } = useApp();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState({ headers: [], rows: [] });
  const [imported, setImported] = useState([]);
  const [skipped, setSkipped] = useState([]);

  const onPickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
    if (result?.type === 'success') {
      const text = await fetch(result.uri).then((r) => r.text());
      setRawText(text);
      const parsed = parseCSV(text);
      setParsed(parsed);
    }
  };

  const onImport = async () => {
    const { headers, rows } = parsed;
    if (!headers.length || !rows.length) {
      Alert.alert('Invalid CSV', 'No rows found.');
      return;
    }

    const headerMap = headers.map((h) => h.toLowerCase().trim());
    const imported = [];
    const skipped = [];

    for (const row of rows) {
      const obj = {};
      for (let i = 0; i < headerMap.length; i++) {
        obj[headerMap[i]] = row[i];
      }

      const date = toISODate(obj.date);
      const amount = Number(obj.amount);
      const type = obj.type === 'income' ? 'income' : 'expense';
      const accountName = obj.account || '';
      const accountId = state.accounts.find((a) => a.name === accountName)?.id || 'unassigned';
      const category = obj.category || (type === 'income' ? 'Income' : 'General');
      const note = obj.note || '';

      if (!date || !isFinite(amount) || !accountId) {
        skipped.push({ ...obj, reason: 'Invalid row' });
        continue;
      }

      const txn = {
        id: rowHash({ date, amount, type, accountId, category, note }),
        date,
        amount,
        type,
        accountId,
        category,
        note,
      };

      try {
        await actions.addTransaction(txn);
        imported.push(txn);
      } catch (e) {
        skipped.push({ ...obj, reason: 'Save failed' });
      }
    }

    setImported(imported);
    setSkipped(skipped);
    Alert.alert('Import complete', `${imported.length} imported, ${skipped.length} skipped.`);
  };

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.h1}>Import CSV</Text>
      <Text style={styles.subtle}>Paste CSV text or pick a file</Text>

      <Pressable style={styles.btn} onPress={onPickFile}>
        <Text style={styles.btnText}>Pick CSV File</Text>
      </Pressable>

      <TextInput
        multiline
        value={rawText}
        onChangeText={(t) => {
          setRawText(t);
          setParsed(parseCSV(t));
        }}
        placeholder="Paste CSV text here"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      <Pressable style={[styles.btn, styles.btnImport]} onPress={onImport}>
        <Text style={styles.btnText}>Import</Text>
      </Pressable>

      <Text style={styles.subtle}>Sample format:</Text>
      <Text style={styles.sample}>{CSV_TEMPLATE}</Text>

      {imported.length > 0 && (
        <View style={styles.result}>
          <Text style={styles.resultText}>✅ Imported: {imported.length}</Text>
        </View>
      )}
      {skipped.length > 0 && (
        <View style={styles.result}>
          <Text style={styles.resultText}>⚠️ Skipped: {skipped.length}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginTop: 8 },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    minHeight: 120,
  },
  btn: {
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnImport: { backgroundColor: '#2563EB' },
  btnText: { color: '#fff', fontWeight: '700' },
  sample: {
    backgroundColor: '#111827',
    color: '#D1D5DB',
    fontFamily: 'Courier',
    padding: 12,
    marginTop: 8,
    borderRadius: 10,
  },
  result: { marginTop: 12 },
  resultText: { color: '#fff', fontWeight: '700' },
});
