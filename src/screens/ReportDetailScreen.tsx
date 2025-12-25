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
<View style={styles.safeWrap}>
  <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  safeWrap: {
    flex: 1,
    backgroundColor: '#050816', // ✅ blue theme background
  },
  wrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 35,
    paddingBottom: 32,
  },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backBtn: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#93C5FD', // ✅ blue accent instead of grey
    fontSize: 14,
    fontWeight: '700',
  },
  h1: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },

  headerPillsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 10,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#111827', // ✅ blue theme card color
  },
  headerPillText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '600',
  },

  // SUMMARY CARD
  summaryCard: {
    backgroundColor: '#111827', // ✅
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  summaryTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  summaryItem: { flex: 1 },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  summarySub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  positiveText: { color: '#22C55E' },
  negativeText: { color: '#F97373' },

  // LIST/CARD
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#111827', // ✅
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },

  // Empty state (if your TransactionList uses these)
  emptyBox: {
    marginTop: 4,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});

export default ReportDetailScreen;
