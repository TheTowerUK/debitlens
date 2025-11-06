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
  const [exporting, setExporting] = useState(false);

  // Map accountId -> name
  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) {
      map[a.id] = a.name;
    }
    return map;
  }, [accounts]);

  // Filter to "this month" & expenses only
  const { monthLabel, monthlyExpenses, groupedByAccount, totalSpend } =
    useMemo(() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      const monthTxs = txs.filter((t) => {
        if (t.type === 'income') return false; // only expenses
        if (!t.date) return false;
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });

      const byAcc: Record<string, number> = {};
      for (const t of monthTxs) {
        const key = t.accountId || 'unknown';
        byAcc[key] = (byAcc[key] || 0) + t.amount;
      }

      const rows = Object.keys(byAcc).map((accountId) => ({
        accountId,
        name: accountNameById[accountId] || 'Account',
        spend: byAcc[accountId],
      }));

      // sort descending by spend
      rows.sort((a, b) => b.spend - a.spend);

      const total = rows.reduce((s, r) => s + r.spend, 0);

      const label = now.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      });

      return {
        monthLabel: label,
        monthlyExpenses: monthTxs,
        groupedByAccount: rows,
        totalSpend: total,
      };
    }, [txs, accountNameById]);

  const exportCsvForMonth = async () => {
    if (!monthlyExpenses.length) {
      Alert.alert(
        'Nothing to export',
        'There are no expenses for this month yet.'
      );
      return;
    }

    try {
      setExporting(true);

      const rows: ReportRow[] = monthlyExpenses.map((t) => ({
        id: String(t.id),
        date: String(t.date),
        amount: Number(t.amount),
        type: String(t.type || ''),
        account_id: String(t.accountId || ''),
        category_id: null,
        note: t.note ?? null,
      }));

      const csv = generateReportCSV(rows);

      const FS: any = FileSystem;
      const base = FS.cacheDirectory ?? '';
      const path = `${base}debitlens_report_month.csv`;
      const encoding = FS.EncodingType?.UTF8 ?? 'utf8';

      if (typeof FS.writeAsStringAsync === 'function') {
        await FS.writeAsStringAsync(path, csv, { encoding });
      } else {
        await FS.writeAsStringAsync(path, csv);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: 'Share this month’s expenses (CSV)',
        });
      } else {
        Alert.alert('CSV saved', path);
      }
    } catch (e: any) {
      console.warn('[reports] exportCsvForMonth failed', e);
      Alert.alert('Export failed', e?.message || 'Could not export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Reports</Text>
          <Text style={styles.subtle}>
            This month’s expenses by account
          </Text>
        </View>
        <Pressable
          style={styles.closePill}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      {/* EXPORT / SUMMARY CARD */}
      <View style={styles.summaryCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>{monthLabel}</Text>
          <Text style={styles.summaryValue}>
            £{totalSpend.toFixed(2)}
          </Text>
          <Text style={styles.summarySubtle}>Total expenses this month</Text>
        </View>
        <Pressable
          style={[
            styles.exportBtn,
            exporting && { opacity: 0.7 },
          ]}
          onPress={exportCsvForMonth}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>Export CSV</Text>
          )}
        </Pressable>
      </View>

      {/* MAIN BODY */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {!groupedByAccount.length && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySubtle}>
              Once you add expense transactions this month, you’ll see a
              breakdown by account here.
            </Text>
          </View>
        )}

        {groupedByAccount.map((row) => {
          const ratio =
            totalSpend > 0 ? row.spend / totalSpend : 0;
          const widthPct = Math.max(0.08, ratio) * 100;

          return (
            <View key={row.accountId} style={styles.rowCard}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{row.name}</Text>
                <Text style={styles.rowAmount}>
                  £{row.spend.toFixed(2)}
                </Text>
              </View>
              <View style={styles.barOuter}>
                <View
                  style={[
                    styles.barInner,
                    { width: `${widthPct}%` },
                  ]}
                />
              </View>
              <Text style={styles.rowPercent}>
                {totalSpend > 0
                  ? `${Math.round((row.spend / totalSpend) * 100)}% of monthly spend`
                  : '0% of monthly spend'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginTop: 2 },

  closePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#020817',
  },
  closeText: { color: '#E5E7EB', fontWeight: '600', fontSize: 13 },

  summaryCard: {
    backgroundColor: '#0B1120',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: { color: '#9CA3AF', fontSize: 13 },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  summarySubtle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },

  exportBtn: {
    marginLeft: 10,
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  scroll: { flex: 1 },

  emptyBox: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  emptyTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700' },
  emptySubtle: { color: '#9CA3AF', marginTop: 4 },

  rowCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowName: { color: '#F9FAFB', fontWeight: '700', fontSize: 15 },
  rowAmount: { color: '#F9FAFB', fontWeight: '800', fontSize: 15 },

  barOuter: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4ADE80',
  },
  rowPercent: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
});
