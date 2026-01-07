import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

import { useApp } from '../state/AppContext';
import { useReportRange, useFilteredTransactions, useTotals } from '../hooks/reports';
import MonthSwitcher from '../components/reports/MonthSwitcher';
import { monthKeyFromDate, type ReportPeriod } from '../utils/reporting';

import { colors as theme } from '../theme/colors'; // 👈 important (your blue theme)

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

export default function ReportDetailScreen({ route }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const { categoryKey, period } = route.params;

  const initialMonthKey =
    period === 'month'
      ? route.params.monthKey || monthKeyFromDate(new Date())
      : monthKeyFromDate(new Date());

  const [monthKey, setMonthKey] = useState(initialMonthKey);

  const effectivePeriod: ReportPeriod = period as ReportPeriod;
  const isMonthPeriod = effectivePeriod === 'month';

  const { range, label, effectiveMonthKey } = useReportRange(
    effectivePeriod,
    isMonthPeriod ? monthKey : undefined
  );

  const filtered = useFilteredTransactions(txs, range, categoryKey);
  const totals = useTotals(filtered);

  const headerTitle = useMemo(() => `${categoryKey} • ${label}`, [categoryKey, label]);

  return (
  <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <View style={styles.container}>
        <Text style={styles.title}>{headerTitle}</Text>

        {isMonthPeriod && effectiveMonthKey ? (
          <MonthSwitcher monthKey={effectiveMonthKey} onChange={setMonthKey} />
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
          ListEmptyComponent={<Text style={styles.empty}>No transactions for this period.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {item.name || item.description || 'Transaction'}
                </Text>
                <Text style={styles.rowSub}>{item.date}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(Number(item.amount) || 0)}</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

function formatMoney(n: number) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}£${abs.toFixed(2)}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.bg,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    color: theme.text,
  },
  summary: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: theme.card,
  },
  summaryText: {
    fontSize: 14,
    marginBottom: 4,
    color: theme.text,
  },
  empty: {
    paddingTop: 16,
    color: theme.textDim,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
  rowSub: { fontSize: 12, color: theme.textDim, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '700', marginLeft: 12, color: theme.text },
});
