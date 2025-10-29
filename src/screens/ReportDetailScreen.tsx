// src/screens/ReportDetailScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useApp } from '../state/AppState';
import { rowHash } from '../utils/csvUtils';
import { CSV_TEMPLATE } from '../utils/csvTemplate';
// use todayISO from your utils if you need a fallback date, otherwise provide a small toISODate helper
import { todayISO } from '../utils/dateUtils';

function toISODate(input: any): string | null {
  if (!input) return null;
  // if input already looks like an ISO date, return normalized string
  const s = String(input).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}


type TxnRow = {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  accountId: string;
  category: string;
  note?: string;
};

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return `${headers.join(',')}\n${rows.map((r) => r.map(esc).join(',')).join('\n')}`;
}

export default function ReportDetailScreen({ route, navigation }: any) {
  const { state } = useApp();
  const [saving, setSaving] = useState(false);

  const transactions: TxnRow[] = useMemo(() => {
    // For demo purposes: create a small, deterministic list from state.transactions
    // Replace filtering logic with your real report logic using route.params
    return (state.transactions || []).map((t: any) => ({
      id: t.id,
      date: toISODate(t.date),
      amount: Number(t.amount),
      type: t.type === 'income' ? 'income' : 'expense',
      accountId: t.accountId || 'unassigned',
      category: t.category || '',
      note: t.note || '',
    }));
  }, [state.transactions]);

  const headers = ['id', 'date', 'amount', 'type', 'accountId', 'category', 'note'];

  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.amount,
    t.type,
    t.accountId,
    t.category,
    t.note || '',
  ]);

  const csvText = useMemo(() => toCSV(headers, rows), [headers, rows]);

  const onSaveAndShare = async () => {
    setSaving(true);
    try {
  const base = (FileSystem as any).cacheDirectory ?? '';
  const filename = `${base}report-${Date.now()}.csv`;
  const encoding = (FileSystem as any).EncodingType?.UTF8 ?? 'utf8';

  if (typeof (FileSystem as any).writeAsStringAsync === 'function') {
    await (FileSystem as any).writeAsStringAsync(filename, csvText, { encoding });
  } else {
    throw new Error('FileSystem.writeAsStringAsync not available');
  }


      // Share the file using RN Share API
      await Share.share({
        message: 'Exported report CSV',
        url: filename,
        title: 'Report CSV',
      });

      Alert.alert('Saved', 'Report saved and ready to share.');
    } catch (e: any) {
      console.warn('Save/Share error', e);
      Alert.alert('Error', e?.message || 'Could not save or share report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Report</Text>

      <View style={styles.section}>
        <Text style={styles.subtle}>Preview CSV</Text>
        <Text style={styles.sample}>{CSV_TEMPLATE}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtle}>Rows</Text>
        <Text style={styles.mono}>{rows.length} rows</Text>
      </View>

      <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onSaveAndShare} disabled={saving}>
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save and Share CSV'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  subtle: { color: '#9CA3AF', marginBottom: 6 },
  section: { marginBottom: 12 },
  sample: {
    backgroundColor: '#111827',
    color: '#D1D5DB',
    fontFamily: 'Courier',
    padding: 12,
    borderRadius: 8,
  },
  mono: { color: '#fff', fontFamily: 'Courier', fontSize: 14 },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnText: { color: '#fff', fontWeight: '700' },
});
