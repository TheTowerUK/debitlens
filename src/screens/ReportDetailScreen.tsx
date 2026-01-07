// src/screens/ReportDetailScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

import { useApp } from '../state/AppContext';
import { useReportRange, useFilteredTransactions, useTotals } from '../hooks/reports';
import MonthSwitcher from '../components/reports/MonthSwitcher';
import { monthKeyFromDate, type ReportPeriod } from '../utils/reporting';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

export default function ReportDetailScreen({ route }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const { categoryKey, period } = route.params;
  const initialMonthKey =
    route.params.period === 'month'
      ? route.params.monthKey || monthKeyFromDate(new Date())
      : monthKeyFromDate(new Date());

  // local month state (only used when period === 'month')
  const [monthKey, setMonthKey] = useState<string>(initialMonthKey);

  const effectivePeriod: ReportPeriod = period as ReportPeriod;

  const { range, label, effectiveMonthKey } = useReportRange(
    effectivePeriod,
    effectivePeriod === 'month' ? monthKey : undefined
  );

  const filtered = useFilteredTransactions(txs, range, categoryKey);
  const totals = useTotals(filtered);

  const headerTitle = useMemo(() => {
    return `${categoryKey} • ${label}`;
  }, [categoryKey, label]);

  const isMonthPeriod = effectivePeriod === 'month';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{headerTitle}</Text>

      {isMonthPeriod ? (
        <MonthSwitcher monthKey={effectiveMonthKey!} onChange={setMonthKey} />
      ) : null}


      <View style={styles.summary}>
        <Text style={styles.summaryText}>Transactions: {totals.count}</Text>
        <Text style={styles.summaryText}>Income: {formatMoney(totals.income)}</Text>
        <Text style={styles.summaryText}>Expense: {formatMoney(totals.expense)}</Text>
        <Text style={styles.summaryText}>Net: {formatMoney(totals.net)}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions for this period.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.name || item.description || 'Transaction'}</Text>
              <Text style={styles.rowSub}>{item.date}</Text>
            </View>
            <Text style={styles.amount}>{formatMoney(Number(item.amount) || 0)}</Text>
          </View>
        )}
      />
    </View>
  );
}

function formatMoney(n: number) {
  // Keep simple; you can swap to your currency/format helper later
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}£${abs.toFixed(2)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 8 },

  summary: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  summaryText: { fontSize: 14, marginBottom: 4 },

  empty: { paddingTop: 16, color: '#666' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, color: '#666', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700', marginLeft: 12 },
});
