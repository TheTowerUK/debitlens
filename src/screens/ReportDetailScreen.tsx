// src/screens/ReportDetailScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../state/AppContext';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function monthKeyToStart(monthKey: string) {
  // monthKey: 'YYYY-MM'
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

  const range = useMemo(() => {
    const now = new Date();
    const today0 = new Date(now);
    today0.setHours(0, 0, 0, 0);

    if (period === 'allTime') return { start: null as Date | null, end: null as Date | null };

    if (period === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }

    if (period === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }

    // period === 'month'
    const mk = monthKey || toMonthKey(now);
    const start = monthKeyToStart(mk) ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
  }, [period, monthKey]);

  const filteredTxs = useMemo(() => {
    const { start, end } = range;

    return txs
      .filter((t) => {
        if (!t?.date) return false;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return false;

        if (start && d < start) return false;
        if (end && d >= end) return false;

        // Category filter:
        // - if categoryKey is "all" show all
        // - else match trimmed text (case sensitive to keep it simple)
        if (categoryKey && categoryKey !== 'all') {
          const cat = String(t.category || 'Uncategorised').trim();
          if (cat !== String(categoryKey).trim()) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return db - da; // newest first
      });
  }, [txs, range, categoryKey]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of filteredTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += Math.abs(amt);
    }

    return {
      income,
      expense,
      net: income - expense,
      count: filteredTxs.length,
    };
  }, [filteredTxs]);

  const mkCurrent = useMemo(() => {
    if (period !== 'month') return null;
    return monthKey || toMonthKey(new Date());
  }, [period, monthKey]);

  const formatMoney = (v: number) => `£${(Number(v) || 0).toFixed(2)}`;

  const title =
    categoryKey === 'all'
      ? 'All categories'
      : String(categoryKey || 'Category');

  const periodLabel = useMemo(() => {
    if (period === 'thisMonth') return 'This month';
    if (period === 'lastMonth') return 'Last month';
    if (period === 'allTime') return 'All time';
    if (period === 'month') return mkCurrent ? formatDisplayMonth(mkCurrent) : 'Month';
    return period;
  }, [period, mkCurrent]);

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
            <Text style={styles.subtle}>{periodLabel} • {totals.count} tx</Text>
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
        {period === 'month' && mkCurrent ? (
          <View style={styles.monthRow}>
            <Pressable style={styles.monthBtn} onPress={goPrevMonth} hitSlop={8}>
              <Text style={styles.monthBtnText}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>{formatDisplayMonth(mkCurrent)}</Text>

            <Pressable style={styles.monthBtn} onPress={goNextMonth} hitSlop={8}>
              <Text style={styles.monthBtnText}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Totals */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.income)}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expense</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.expense)}</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text
                style={[
                  styles.summaryValue,
                  totals.net >= 0 ? styles.positiveText : styles.negativeText,
                ]}
              >
                {totals.net >= 0 ? '+' : '-'}
                {formatMoney(Math.abs(totals.net))}
              </Text>
            </View>
          </View>
        </View>

        {/* Transaction list */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Transactions</Text>

          {filteredTxs.length === 0 ? (
            <Text style={styles.subtle}>No transactions found for this selection.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {filteredTxs.map((t) => {
                const amt = Number(t.amount) || 0;
                const isExpense = t.type === 'expense';
                const cat = String(t.category || 'Uncategorised').trim();

                return (
                  <View key={t.id} style={styles.txRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle}>{t.name || 'Transaction'}</Text>
                      <Text style={styles.txSub}>
                        {new Date(t.date).toLocaleDateString()} • {cat}
                      </Text>
                      {t.description ? (
                        <Text style={styles.txSubDim} numberOfLines={2}>
                          {t.description}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={[styles.txAmount, isExpense ? styles.negativeText : styles.positiveText]}>
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

  summaryRow: { flexDirection: 'row', columnGap: 10 },
  summaryItem: { flex: 1 },
  summaryLabel: { color: theme.textDim, fontSize: 12, marginBottom: 2 },
  summaryValue: { color: theme.text, fontSize: 16, fontWeight: '900' },

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
