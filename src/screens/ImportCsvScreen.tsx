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
  const [parsed, setParsed] = useState<any>({ headers: [], rows: [] });
  const [imported, setImported] = useState<any[]>([]);
  const [skipped, setSkipped] = useState<any[]>([]);

  // helper alias for the success shape we expect
type DocSuccess = { type: 'success'; uri: string; name?: string; size?: number; mimeType?: string };
type DocCancelled = { type: 'cancel' };
type DocResultAny = any; // intentionally loose; we guard at runtime

const onPickFile = async () => {
  try {
    const result = (await DocumentPicker.getDocumentAsync({ type: 'text/*' })) as DocResultAny;
    if (result && 'type' in result && result.type === 'success' && 'uri' in result && typeof result.uri === 'string') {
      const text = await fetch((result as DocSuccess).uri).then((r) => r.text());
      setRawText(text);
      const p = parseCSV(text);
      setParsed(p as any);
    } else {
      // user cancelled or unexpected result
      return;
    }
  } catch (e) {
    console.warn('Pick file failed', e);
    Alert.alert('Error', 'Could not read file.');
  }
};


  const onImport = async () => {
    // assume parsed may be unknown shape; narrow at runtime
    const headers = (parsed as any)?.headers || [];
    const rows = (parsed as any)?.rows || [];

    if (!headers.length || !rows.length) {
      Alert.alert('Invalid CSV', 'No rows found.');
      return;
    }

    const headerMap = headers.map((h: any) => String(h || '').toLowerCase().trim());
    const importedTxns: any[] = [];
    const skippedRows: any[] = [];

    for (const rawRow of rows as any[]) {
      // normalize to an object with lowercase keys
      let obj: Record<string, any> = {};

      if (Array.isArray(rawRow)) {
        for (let i = 0; i < headerMap.length; i++) {
          obj[headerMap[i]] = rawRow[i];
        }
      } else if (rawRow && typeof rawRow === 'object') {
        for (const k of Object.keys(rawRow)) {
          obj[String(k).toLowerCase().trim()] = rawRow[k];
        }
      } else {
        skippedRows.push({ raw: rawRow, reason: 'Unexpected row format' });
        continue;
      }

      // runtime guard for required fields
      if (!('date' in obj) || !('amount' in obj)) {
        skippedRows.push({ ...obj, reason: 'Missing date or amount' });
        continue;
      }

      const date = toISODate(String(obj.date || ''));
      const amount = Number(String(obj.amount).replace(/[^\d.-]/g, ''));
      const type = String((obj.type || '').toLowerCase()) === 'income' ? 'income' : 'expense';
      const accountName = String(obj.account || '').trim();
      const accountId = state.accounts.find((a: any) => a.name === accountName)?.id || 'unassigned';
      const category = String(obj.category || (type === 'income' ? 'Income' : 'General'));
      const note = String(obj.note || '');

      if (!date || !isFinite(amount) || !accountId) {
        skippedRows.push({ ...obj, reason: 'Invalid row' });
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
        importedTxns.push(txn);
      } catch {
        skippedRows.push({ ...obj, reason: 'Save failed' });
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
