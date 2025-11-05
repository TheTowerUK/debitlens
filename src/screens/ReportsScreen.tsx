// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';
import { generateReportCSV, type ReportRow } from '../services/reporting';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

export default function ReportsScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];
  const [busy, setBusy] = useState(false);

  const rows: ReportRow[] = useMemo(
    () =>
      txs.map(t => ({
        id: String(t.id),
        date: String(t.date),
        amount: Number(t.amount),
        type: String(t.type || ''),
        account_id: String(t.accountId || ''),
        category_id: null,
        note: t.note ?? null,
      })),
    [txs]
  );

  const summary = useMemo(() => {
    if (rows.length === 0) return { income: 0, expense: 0, first: null as Date | null, last: null as Date | null };
    let income = 0;
    let expense = 0;
    let first: Date | null = null;
    let last: Date | null = null;
    for (const r of rows) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
      const d = new Date(r.date);
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
    }
    return { income, expense, first, last };
  }, [rows]);

  const exportAll = async () => {
    if (rows.length === 0) {
      Alert.alert('No data', 'There are no transactions to export yet.');
      return;
    }
    try {
      setBusy(true);
      const csv = generateReportCSV(rows);

      const FS: any = FileSystem;
      const base = FS.cacheDirectory ?? '';
      const path = `${base}debitlens_report_all.csv`;
      const encoding = FS.EncodingType?.UTF8 ?? 'utf8';

      if (typeof FS.writeAsStringAsync === 'function') {
        await FS.writeAsStringAsync(path, csv, { encoding });
      } else {
        await FS.writeAsStringAsync(path, csv);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: 'Share CSV report',
        });
      } else {
        Alert.alert('CSV saved', path);
      }
    } catch (e: any) {
      console.warn('[reports] exportAll failed', e);
      Alert.alert('Export failed', e?.message || 'Could not export CSV');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>
        Export all transactions as a CSV file.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.kv}>
          Accounts:{' '}
          <Text style={styles.kvValue}>{accounts.length}</Text>
        </Text>
        <Text style={styles.kv}>
          Transactions:{' '}
          <Text style={styles.kvValue}>{rows.length}</Text>
        </Text>
        <Text style={styles.kv}>
          Income:{' '}
          <Text style={[styles.kvValue, styles.green]}>
            £{summary.income.toFixed(2)}
          </Text>
        </Text>
        <Text style={styles.kv}>
          Expense:{' '}
          <Text style={[styles.kvValue, styles.red]}>
            £{summary.expense.toFixed(2)}
          </Text>
        </Text>
        <Text style={styles.kv}>
          Net:{' '}
          <Text
            style={[
              styles.kvValue,
              summary.income - summary.expense >= 0
                ? styles.green
                : styles.red,
            ]}
          >
            £{(summary.income - summary.expense).toFixed(2)}
          </Text>
        </Text>
        <Text style={styles.kv}>
          Period:{' '}
          <Text style={styles.kvValue}>
            {summary.first && summary.last
              ? `${summary.first.toLocaleDateString()} — ${summary.last.toLocaleDateString()}`
              : 'n/a'}
          </Text>
        </Text>

        <Pressable
          style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
          onPress={exportAll}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Export all as CSV</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text style={styles.sectionTitle}>Preview (latest 20)</Text>
        {rows.length === 0 && (
          <Text style={styles.empty}>No transactions to show.</Text>
        )}

        {rows
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 20)
          .map(r => {
            const isIncome = r.type === 'income';
            const sign = isIncome ? '+' : '-';
            const colour = isIncome ? '#34D399' : '#F87171';
            const d = new Date(r.date);
            return (
              <View key={r.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowNote}>{r.note || '(no note)'}</Text>
                  <Text style={styles.rowSub}>
                    {r.account_id || 'Unknown'} · {d.toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, { color: colour }]}>
                  {sign}£{r.amount.toFixed(2)}
                </Text>
              </View>
            );
          })}
      </ScrollView>

      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        disabled={busy}
      >
        <Text style={styles.backBtnText}>Back to Dashboard</Text>
      </Pressable>
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
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  kv: { color: '#9CA3AF', marginTop: 2 },
  kvValue: { color: '#E5E7EB', fontWeight: '700' },
  red: { color: '#F87171' },
  green: { color: '#34D399' },

  btn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnText: { color: '#fff', fontWeight: '700' },

  scroll: { flex: 1, marginTop: 4 },
  empty: { color: '#6B7280', marginTop: 4 },

  row: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: { flexShrink: 1, paddingRight: 8 },
  rowNote: { color: '#E5E7EB', fontWeight: '600' },
  rowSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '800' },

  backBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
  },
  backBtnText: { color: '#E5E7EB', fontWeight: '700' },
});
