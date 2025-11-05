// src/screens/HistoryScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';
import { generateReportCSV, type ReportRow } from '../services/reporting';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const { state } = useApp();
  const [exporting, setExporting] = useState(false);

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  // Build a quick lookup for account names
  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) {
      map[a.id] = a.name;
    }
    return map;
  }, [accounts]);

  // Sort transactions newest -> oldest and group by date (YYYY-MM-DD)
  const grouped = useMemo(() => {
    const copy = [...txs].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );
    const byDay: Record<string, typeof copy> = {};
    for (const t of copy) {
      const day = (t.date || '').slice(0, 10) || 'Unknown date';
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(t);
    }
    return byDay;
  }, [txs]);

  const dayKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped]
  );

  const exportAllCsv = async () => {
    if (!txs.length) {
      Alert.alert('No data', 'There are no transactions to export yet.');
      return;
    }

    try {
      setExporting(true);

      const rows: ReportRow[] = txs.map(t => ({
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
      const path = `${base}debitlens_history_all.csv`;
      const encoding = FS.EncodingType?.UTF8 ?? 'utf8';

      if (typeof FS.writeAsStringAsync === 'function') {
        await FS.writeAsStringAsync(path, csv, { encoding });
      } else {
        await FS.writeAsStringAsync(path, csv);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: 'Share all transactions (CSV)',
        });
      } else {
        Alert.alert('CSV saved', path);
      }
    } catch (e: any) {
      console.warn('[history] exportAllCsv failed', e);
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
          <Text style={styles.h1}>History</Text>
          <Text style={styles.subtle}>
            All transactions, newest first
          </Text>
        </View>
        <Pressable
          style={styles.closePill}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      {/* EXPORT BAR */}
      <View style={styles.exportCard}>
        <Text style={styles.exportLabel}>Export</Text>
        <Pressable
          style={[
            styles.exportBtn,
            exporting && { opacity: 0.7 },
          ]}
          onPress={exportAllCsv}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>Export all as CSV</Text>
          )}
        </Pressable>
      </View>

      {/* HISTORY LIST */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {txs.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtle}>
              Add some transactions on your accounts and they&apos;ll show here.
            </Text>
          </View>
        )}

        {dayKeys.map(day => (
          <View key={day} style={styles.dayBlock}>
            <Text style={styles.dayLabel}>
              {day === 'Unknown date'
                ? 'Unknown date'
                : new Date(day + 'T00:00:00').toLocaleDateString()}
            </Text>

            {grouped[day].map(t => {
              const isIncome = t.type === 'income';
              const sign = isIncome ? '+' : '-';
              const colour = isIncome ? '#34D399' : '#F87171';
              const accName = accountNameById[t.accountId] || 'Account';

              return (
                <View key={t.id} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txNote}>
                      {t.note || '(no note)'}
                    </Text>
                    <Text style={styles.txMeta}>
                      {accName} · {t.type === 'income' ? 'Income' : 'Expense'}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: colour }]}>
                    {sign}£{Number(t.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
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

  exportCard: {
    backgroundColor: '#0B1120',
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exportLabel: { color: '#9CA3AF', fontSize: 13 },
  exportBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 6,
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

  dayBlock: {
    marginTop: 12,
  },
  dayLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4,
  },

  txRow: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: { flexShrink: 1, paddingRight: 8 },
  txNote: { color: '#E5E7EB', fontWeight: '600' },
  txMeta: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
});
