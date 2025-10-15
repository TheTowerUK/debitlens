// src/screens/ImportCsvScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../state/AppState';

// ---------- Utilities ----------
const pad2 = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

// Poor-man’s CSV parser (handles quotes, commas, newlines in quotes)
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += c; i++; continue; }
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        // handle \r\n
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); field = ''; row = []; i++; continue;
      }
      field += c; i++; continue;
    }
  }
  // trailing field
  if (field.length || row.length) { row.push(field); rows.push(row); }
  // trim BOM if present on first cell
  if (rows.length && rows[0].length) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}

// stable hash for dedupe (based on key fields)
function rowHash(obj) {
  const base = [
    obj.date || '',
    isFinite(Number(obj.amount)) ? Number(obj.amount).toFixed(2) : '',
    (obj.type || '').toLowerCase(),
    (obj.account || obj.accountName || obj.accountId || ''),
    (obj.category || ''),
    (obj.note || ''),
  ].join('|');
  let h = 0;
  for (let i = 0; i < base.length; i++) h = ((h << 5) - h) + base.charCodeAt(i) | 0;
  return String(h);
}

// Accept common header aliases
const HEADER_MAP = {
  date: ['date', 'transaction_date', 'posted', 'post_date'],
  amount: ['amount', 'amt', 'value'],
  type: ['type', 'txn_type', 'direction'], // expense/income or outflow/inflow
  account: ['account', 'account_name', 'accountid', 'account_id'],
  category: ['category', 'cat'],
  note: ['note', 'description', 'memo', 'narrative', 'merchant', 'payee'],
};

// Try to map input header names to our canonical keys
function mapHeaders(headers) {
  const lower = headers.map(h => (h || '').trim().toLowerCase());
  const mapping = {};
  for (const key of Object.keys(HEADER_MAP)) {
    const aliases = HEADER_MAP[key];
    const idx = lower.findIndex(h => aliases.includes(h));
    if (idx >= 0) mapping[key] = idx;
  }
  return mapping;
}

// normalize type values → 'expense' | 'income'
function normalizeType(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['expense', 'debit', 'out', 'outflow', 'withdrawal'].includes(s)) return 'expense';
  if (['income', 'credit', 'in', 'inflow', 'deposit'].includes(s)) return 'income';
  return null; // unknown → infer by amount sign
}

// ---------- Screen ----------
export default function ImportCsvScreen({ navigation }) {
  const { state, actions } = useApp();
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);          // parsed, normalized preview rows
  const [skipped, setSkipped] = useState([]);    // [{line, reason}]
  const [sessionTag, setSessionTag] = useState(null); // random tag for this import

  const accounts = state?.accounts || [];
  const txns = state?.transactions || [];

  const byAccountName = useMemo(() => {
    const m = {};
    for (const a of accounts) m[String(a.name).toLowerCase()] = String(a.id);
    return m;
  }, [accounts]);

  const existingHashSet = useMemo(() => {
    const set = new Set();
    for (const t of txns) {
      const m = String(t.note || '').match(/\[h:([-]?\d+)\]/);
      if (m) set.add(m[1]);
    }
    return set;
  }, [txns]);

  const pickFile = async () => {
    try {
      setBusy(true);
      setRows([]); setSkipped([]); setSessionTag(null);

      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) { setBusy(false); return; }

      const asset = res.assets?.[0];
      const uri = asset?.uri;
      setFileName(asset?.name || 'import.csv');

      const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const table = parseCSV(text);
      if (!table.length) {
        Alert.alert('CSV', 'The file is empty.');
        setBusy(false);
        return;
      }

      const headers = table[0].map(h => (h || '').trim());
      const map = mapHeaders(headers);

      // Require minimum fields
      if (map.date == null || map.amount == null) {
        Alert.alert('CSV',
          'Missing required headers. Expected at least: date, amount. Optional: type, account, category, note.');
        setBusy(false);
        return;
      }

      const preview = [];
      const rejected = [];
      for (let i = 1; i < table.length; i++) {
        const line = table[i];
        if (!line || line.every(c => (c || '').trim() === '')) continue;

        const raw = {
          date: line[map.date],
          amount: line[map.amount],
          type: map.type != null ? line[map.type] : '',
          account: map.account != null ? line[map.account] : '',
          category: map.category != null ? line[map.category] : '',
          note: map.note != null ? line[map.note] : '',
        };

        // Normalize date (accept YYYY-MM-DD or DD/MM/YYYY)
        let date = String(raw.date || '').trim();
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
          const [d, m, y] = date.split('/');
          date = `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          rejected.push({ line: i + 1, reason: 'Invalid date' });
          continue;
        }

        // Amount
        const amt = Number(String(raw.amount || '').replace(/[, ]/g, ''));
        if (!isFinite(amt) || amt === 0) {
          rejected.push({ line: i + 1, reason: 'Invalid amount' });
          continue;
        }

        // Type
        let t = normalizeType(raw.type);
        if (!t) t = amt < 0 ? 'expense' : 'income';
        const absAmount = Math.abs(amt);

        const accountName = String(raw.account || '').trim() || 'Imported';
        const category = String(raw.category || '').trim() || (t === 'income' ? 'Income' : 'General');
        const note = String(raw.note || '').trim();

        const norm = { date, amount: absAmount, type: t, accountName, category, note };
        const h = rowHash(norm);

        preview.push({ ...norm, hash: h });
      }

      setRows(preview);
      setSkipped(rejected);
      setBusy(false);
    } catch (e) {
      console.warn('[csv] pick failed', e);
      setBusy(false);
      Alert.alert('Import', 'Could not read this file.');
    }
  };

  const doImport = async () => {
    if (!rows.length) return;
    try {
      setBusy(true);
      const tag = `imp-${Date.now().toString(36)}`;
      setSessionTag(tag);

      let imported = 0, dupes = 0;
      const newIds = [];

      // Build a mutable account map
      const nameToId = { ...byAccountName };

      for (const r of rows) {
        if (existingHashSet.has(r.hash)) { dupes++; continue; }

        // Resolve or create account
        const key = r.accountName.toLowerCase();
        let accountId = nameToId[key];
        if (!accountId) {
          // create account
          const created = await actions.addAccount(r.accountName, 'current');
          // Some actions.addAccount return the created account; if not, re-index from state later.
          const id = String(created?.id || created || (state.accounts.slice(-1)[0]?.id));
          accountId = id;
          nameToId[key] = id;
        }

        // Append dedupe hash + session tag in note
        const decoratedNote = `${r.note ? r.note + ' ' : ''}[h:${r.hash}] [import:${tag}]`;

        // Add transaction (ensure addTransaction returns created id if possible)
        const createdTxn = await actions.addTransaction({
          accountId,
          type: r.type,
          amount: r.amount,
          date: r.date,
          category: r.category,
          note: decoratedNote,
        });

        if (createdTxn?.id) newIds.push(String(createdTxn.id));
        imported++;
      }

      // Heuristic recurring suggestion (very simple)
      const recent = (state.transactions || []).slice(-100);
      const freqMap = {};
      for (const t of recent) {
        const key = `${t.type}|${t.category}|${Number(t.amount).toFixed(2)}`;
        freqMap[key] = (freqMap[key] || 0) + 1;
      }
      const candidates = Object.entries(freqMap).filter(([, c]) => c >= 3);

      Alert.alert(
        'Import complete',
        `Imported ${imported} ${imported === 1 ? 'item' : 'items'}${dupes ? `, skipped ${dupes} duplicate(s)` : ''}.`,
        [
          { text: 'OK' },
          ...(candidates.length
            ? [{ text: 'Review recurring', onPress: () => navigation.navigate('Recurring') }]
            : []),
        ]
      );
    } catch (e) {
      console.warn('[csv] import failed', e);
      Alert.alert('Import failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const undoLastImport = async () => {
    if (!sessionTag) return;
    try {
      setBusy(true);
      // Find txns with this session tag in the note and delete them
      const all = state.transactions || [];
      const mine = all.filter(t => String(t.note || '').includes(`[import:${sessionTag}]`));
      for (const t of mine) {
        await actions.deleteTransaction(String(t.id));
      }
      Alert.alert('Undo', `Removed ${mine.length} imported ${mine.length === 1 ? 'item' : 'items'}.`);
      setSessionTag(null);
    } catch (e) {
      console.warn('[csv] undo failed', e);
      Alert.alert('Undo failed', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const importableCount = useMemo(() => {
    let n = 0, d = 0;
    for (const r of rows) {
      if (existingHashSet.has(r.hash)) d++;
      else n++;
    }
    return { n, d };
  }, [rows, existingHashSet]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Import CSV</Text>
      <Text style={styles.subtle}>Headers: date, amount, (type), (account), (category), (note)</Text>

      <View style={styles.card}>
        <Pressable
          style={[styles.btn, styles.btnSave]}
          onPress={pickFile}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Select CSV file</Text>}
        </Pressable>

        {!!fileName && (
          <Text style={[styles.subtle, { marginTop: 8 }]} numberOfLines={1}>
            Selected: {fileName}
          </Text>
        )}

        {!!rows.length && !busy && (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                Ready: {importableCount.n} • Duplicates: {importableCount.d} • Invalid rows: {skipped.length}
              </Text>
            </View>

            <Pressable
              style={[styles.btn, styles.btnSave, { marginTop: 8 }]}
              onPress={doImport}
            >
              <Text style={styles.btnText}>Import</Text>
            </Pressable>

            {!!sessionTag && (
              <Pressable
                style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
                onPress={undoLastImport}
              >
                <Text style={styles.btnText}>Undo last import</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {!!skipped.length && (
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Skipped rows ({skipped.length})</Text>
          <ScrollView style={{ maxHeight: 140 }}>
            {skipped.slice(0, 50).map((s, i) => (
              <Text key={`${s.line}-${i}`} style={styles.subtle}>
                Line {s.line}: {s.reason}
              </Text>
            ))}
            {skipped.length > 50 && (
              <Text style={styles.subtle}>…and more</Text>
            )}
          </ScrollView>
        </View>
      )}

      {!!rows.length && (
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Preview (first 8)</Text>
          <ScrollView style={{ maxHeight: 240 }}>
            {rows.slice(0, 8).map((r, i) => (
              <View key={`${r.hash}-${i}`} style={styles.previewRow}>
                <Text style={[styles.cell, { flex: 1.2 }]}>{r.date}</Text>
                <Text style={[styles.cell, r.type === 'expense' ? styles.red : styles.green]}>
                  {r.type === 'expense' ? '-' : '+'}{Number(r.amount).toFixed(2)}
                </Text>
                <Text style={[styles.cell, { flex: 1 }]}>{r.accountName}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{r.category}</Text>
                <Text style={[styles.cell, { flex: 1.6 }]} numberOfLines={1}>
                  {r.note}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
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
  btnText: { color: '#fff', fontWeight: '700' },

  summary: { marginTop: 8 },
  summaryText: { color: '#E5E7EB', fontWeight: '700' },

  rowTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },

  previewRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomColor: '#1F2937',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: { color: '#E5E7EB', marginRight: 8 },
  red: { color: '#F87171' },
  green: { color: '#34D399' },
});
