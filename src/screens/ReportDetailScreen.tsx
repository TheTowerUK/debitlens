// src/screens/ReportDetailScreen.tsx
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp, type Transaction } from '../state/AppContext';

// hooks
import { useReportRange } from '../hooks/reports/useReportRange';
import { useFilteredTransactions } from '../hooks/reports/useFilteredTransactions';
import { useTotals } from '../hooks/reports/useTotals';

// components (named exports)
import { MonthSwitcher } from '../components/reports/MonthSwitcher';
import { SummaryCard } from '../components/reports/SummaryCard';
import { TransactionList } from '../components/reports/TransactionList';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

// Helps silence “Text string 'month'...” watcher in some setups
const PERIOD_MONTH: 'month' = 'month';

const ReportDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state } = useApp();
  const txs: Transaction[] = state.transactions || [];
  const accounts = state.accounts || [];

  const { categoryKey, period, monthKey } = route.params;

  // useReportRange returns { range, effectiveMonthKey, label }
  const { range, effectiveMonthKey, label } = useReportRange(period, monthKey);

  const filteredTxs = useFilteredTransactions(txs, range, categoryKey);

  const sortedTxs = useMemo(() => {
    return filteredTxs.slice().sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
  }, [filteredTxs]);

  const totals = useTotals(filteredTxs);

  const title =
    categoryKey === 'Uncategorised' ? 'Uncategorised' : categoryKey;

  const onBack = useCallback(() => navigation.goBack(), [navigation]);

  const onChangeMonthKey = useCallback(
    (nextMonthKey: string) => {
      navigation.setParams({ monthKey: nextMonthKey });
    },
    [navigation],
  );

  const monthSwitcherVisible = period === PERIOD_MONTH;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'} Back</Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{title}</Text>
          <Text style={styles.subtle}>Period: {label}</Text>
        </View>
      </View>

      {/* Month switcher */}
      <MonthSwitcher
        visible={monthSwitcherVisible}
        monthKey={effectiveMonthKey || ''}
        onChange={onChangeMonthKey}
        styles={styles}
      />

      {/* Summary */}
      <SummaryCard totals={totals} count={sortedTxs.length} styles={styles} />

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>

      <TransactionList txs={sortedTxs} accounts={accounts} styles={styles} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  wrap: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 32,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  h1: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 2,
  },

  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },

  // Note: your existing styles file previously contained many more keys
  // (headerPill, summaryCard, etc). If MonthSwitcher/SummaryCard/TransactionList
  // reference those style keys via styles.<key>, keep them here too.
});

export default ReportDetailScreen;
