// src/screens/ReportDetailScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp, type TransactionType } from '../state/AppContext';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

import { useReportRange } from '../hooks/reports/useReportRange';
import { useFilteredTransactions } from '../hooks/reports/useFilteredTransactions';
import { useReportTotals } from '../hooks/reports/useReportTotals';

import { SummaryCard } from '../components/reports/SummaryCard';
import { EmptyState } from '../components/reports/EmptyState';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

const TYPE_EXPENSE: TransactionType = 'expense';
const TYPE_INCOME: TransactionType = 'income';
const CAT_ALL = 'all';
const CAT_UNCATEGORISED = 'Uncategorised';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthKeyToStart(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return null;
  return new Date(y, m - 1, 1);
}

function addMonths(monthKey: string, delta: number) {
  const start = monthKeyToStart(monthKey);
  if (!start) return monthKey;
  const d = new Date(start.getFullYear(), start.getMonth() + delta, 1);
  return toMonthKey(d);
}

function formatDisplayMonth(monthKey: string) {
  const start = monthKeyToStart(monthKey);
  if (!start) return monthKey;
  return start.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

export default function ReportDetailScreen({ navigation, route }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const { categoryKey, period, monthKey } = route.params;

  // Range is now centralized (Phase 3.2)
  const range = useReportRange(period as any, monthKey);

  // Range-only filtering (keeps hook single-responsibility)
  const inRangeTxs = useFilteredTransactions(txs, range.start, range.end);

  // Apply category filter in the screen (you already have categoryKey here)
  const filteredTxs = useMemo(() => {
    if (!categoryKey || categoryKey === CAT_ALL) return inRangeTxs;

    const target = String(categoryKey).trim();
    return inRangeTxs.filter((t) => {
      const cat = String(t.category || CAT_UNCATEGORISED).trim() || CAT_UNCATEGORISED;
      return cat === target;
    });
  }, [inRangeTxs, categoryKey]);

  // Totals via shared hook (Phase 3.2)
  const totalsBase = useReportTotals(filteredTxs);
  const totals = useMemo(
    () => ({ ...totalsBase, count: filteredTxs.length }),
    [totalsBase, filteredTxs.length]
  );

  // Month view helpers (keep your existing UX)
  const mkCurrent = useMemo(() => {
    if (period !== 'month') return null;
    return monthKey || toMonthKey(new Date());
  }, [period, monthKey]);

  const isMonthView = period === 'month' && !!mkCurrent;
  const monthTitle = isMonthView ? formatDisplayMonth(mkCurrent!) : '';

  const formatMoney = (v: number) => `£${(Number(v) || 0).toFixed(2)}`;

  const title =
    categoryKey === CAT_ALL ? 'All categories' : String(categoryKey || 'Category');

  // Prefer the shared range label for month naming consistency
  const periodLabel = useMemo(() => {
    if (period === 'allTime') return 'All time';
    if (period === 'month') return mkCurrent ? formatDisplayMonth(mkCurrent) : range.label;
    return range.label;
  }, [period, mkCurrent, range.label]);

  const setPeriod = (p: RootStackParamList['ReportDetail']['period']) => {
    if (p === 'month') {
      const mk = mkCurrent || toMonthKey(new Date());
      navigation.setParams({ period: 'month', monthKey: mk });
      return;
    }
    navigation.setParams({ period: p, monthKey: undefined });
  };

  const goPrevMonth = () => {
    if (!mkCurrent) return;
    navigation.setParams({ monthKey: addMonths(mkCurrent, -1) });
  };

  const goNextMonth = () => {
    if (!mkCurrent) return;
    navigation.setParams({ monthKey: addMonths(mkCurrent, +1) });
  };

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{title}</Text>
            <Text style={styles.subtle}>
              {periodLabel} • {totals.count} tx
            </Text>
          </View>

          <Pressable style={styles.headerPill} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.headerPillText}>Back</Text>
          </Pressable>
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
          <Pressable
            style={[styles.periodBtn, period === 'thisMonth' && styles.periodBtnActive]}
            onPress={() => setPeriod('thisMonth')}
          >
            <Text style={[styles.periodText, period === 'thisMonth' && styles.periodTextActive]}>
              This month
            </Text>
          </Pressable>

          <Pressable
            style={[styles.periodBtn, period === 'lastMonth' && styles.periodBtnActive]}
            onPress={() => setPeriod('lastMonth')}
          >
            <Text style={[styles.periodText, period === 'lastMonth' && styles.periodTextActive]}>
              Last month
            </Text>
          </Pressable>

          <Pressable
            style={[styles.periodBtn, period === 'allTime' && styles.periodBtnActive]}
            onPress={() => setPeriod('allTime')}
          >
            <Text style={[styles.periodText, period === 'allTime' && styles.periodTextActive]}>
              All time
            </Text>
          </Pressable>

          <Pressable
            style={[styles.periodBtn, period === 'month' && styles.periodBtnActive]}
            onPress={() => setPeriod('month')}
          >
            <Text style={[styles.periodText, period === 'month' && styles.periodTextActive]}>
              Month
            </Text>
          </Pressable>
        </View>

        {/* Month switcher (only when period === 'month') */}
        {isMonthView ? (
          <View style={styles.monthRow}>
            <Pressable style={styles.monthBtn} onPress={goPrevMonth} hitSlop={8}>
              <Text style={styles.monthBtnText}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>{monthTitle}</Text>

            <Pressable style={styles.monthBtn} onPress={goNextMonth} hitSlop={8}>
              <Text style={styles.monthBtnText}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Totals (Phase 3.2 shared components) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>

          <SummaryCard title="Income" value={formatMoney(totals.income)} />
          <SummaryCard title="Expense" value={formatMoney(totals.expense)} />
          <SummaryCard
            title="Net"
            value={`${totals.net >= 0 ? '+' : '-'}${formatMoney(Math.abs(totals.net))}`}
            subtitle={`${totals.count} transaction${totals.count === 1 ? '' : 's'} in this period`}
          />
        </View>

        {/* Transaction list */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transactions</Text>

          {filteredTxs.length === 0 ? (
            <EmptyState title="No transactions found" body="Try a different period or category." />
          ) : (
            <View style={{ marginTop: 8 }}>
              {filteredTxs.map((t) => {
                const amt = Number(t.amount) || 0;
                const isExpense = t.type === TYPE_EXPENSE;
                const cat =
                  String(t.category || CAT_UNCATEGORISED).trim() || CAT_UNCATEGORISED;

                return (
                  <View key={t.id} style={styles.txRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle}>{t.description || 'Transaction'}</Text>
                      <Text style={styles.txSub}>
                        {new Date(t.date).toLocaleDateString()} • {cat}
                      </Text>
                      {t.description ? (
                        <Text style={styles.txSubDim} numberOfLines={2}>
                          {t.description}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={[
                        styles.txAmount,
                        isExpense ? styles.negativeText : styles.positiveText,
                      ]}
                    >
                      {isExpense ? '-' : '+'}
                      {formatMoney(Math.abs(amt))}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeWrap: { flex: 1, backgroundColor: theme.bg },
  wrap: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
    marginBottom: 12,
  },
  h1: { color: theme.text, fontSize: 22, fontWeight: '800' },
  subtle: { color: theme.textDim, marginTop: 4 },

  headerPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  headerPillText: { color: '#E5E7EB', fontWeight: '700', fontSize: 13 },

  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
  },
  periodBtnActive: {
    backgroundColor: theme.card,
    borderColor: theme.link,
  },
  periodText: { color: theme.textDim, fontWeight: '700', fontSize: 12 },
  periodTextActive: { color: theme.text },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  monthTitle: { color: theme.text, fontWeight: '800' },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  monthBtnText: { color: theme.link, fontSize: 22, fontWeight: '900' },

  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 10 },

  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  txTitle: { color: theme.text, fontWeight: '800' },
  txSub: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  txSubDim: { color: theme.textDim, fontSize: 12, marginTop: 4, opacity: 0.8 },

  txAmount: { fontWeight: '900', marginLeft: 10 },

  positiveText: { color: theme.positive },
  negativeText: { color: theme.negative },
});
