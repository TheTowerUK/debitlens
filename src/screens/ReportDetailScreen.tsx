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
import { colors as theme } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

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
  <SafeAreaView style={styles.safeWrap} edges={['top', 'left', 'right']}>
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
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

        {/* Month switcher (props match your component contract) */}
        <MonthSwitcher
          visible={monthSwitcherVisible}
          monthKey={effectiveMonthKey || ''}
          onChange={onChangeMonthKey}
          styles={styles}
          // if your MonthSwitcher internally renders "Prev/This month/Next"
          // the spacing is handled by the style below (pillText padding)
        />

        {/* Summary */}
        <SummaryCard totals={totals} count={sortedTxs.length} styles={styles} />

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Transactions</Text>

        <TransactionList txs={sortedTxs} accounts={accounts} styles={styles} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeWrap: {
    flex: 1,
    backgroundColor: theme.bg, 
  },
  wrap: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 35,
    paddingBottom: 32,
    backgroundColor: theme.bg,
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
    color: theme.link,
    fontSize: 14,
    fontWeight: '700',
  },
  h1: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  subtle: {
    color: theme.textDim,
    marginTop: 4,
  },

  // Month switcher pills (used by MonthSwitcher)
  headerPillsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 16,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
  },
  headerPillText: {
    color: theme.pillText,
    fontSize: 13,
    fontWeight: '600',
    // ✅ "space after Prev / This month / Next" – add a tiny right padding
    paddingRight: 1,
  },

  // SUMMARY CARD (used by SummaryCard)
  summaryCard: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
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
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  summarySub: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },

  positiveText: { color: theme.positive },
  negativeText: { color: theme.negative },

  // SECTION
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },

  // LIST / CARD (used by TransactionList)
  card: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  txRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  txLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.text, // ✅ ensures not black even if overrides fail
  },
  txNote: {
    color: theme.textDim,
    fontSize: 13,
    marginTop: 2,
  },
  txMeta: {
    color: theme.textDim,
    fontSize: 11,
    marginTop: 4,
  },

  // Empty state (if TransactionList uses these)
  emptyBox: {
    marginTop: 4,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: theme.textDim,
    fontSize: 14,
  },
});

export default ReportDetailScreen;
