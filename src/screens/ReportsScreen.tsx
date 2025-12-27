// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../state/AppContext';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

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

export default function ReportsScreen({ navigation }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const [period, setPeriod] =
    useState<RootStackParamList['ReportDetail']['period']>('thisMonth');

  const [monthKey, setMonthKey] = useState<string>(toMonthKey(new Date()));

  const range = useMemo(() => {
    const now = new Date();

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
    const start = monthKeyToStart(monthKey) ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
  }, [period, monthKey]);

  const formatMoney = (v: number) => `£${(Number(v) || 0).toFixed(2)}`;

  const { totalExpense, categories } = useMemo(() => {
    const { start, end } = range;

    const byCat: Record<string, number> = {};
    let total = 0;

    for (const t of txs) {
      if (!t?.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;

      if (start && d < start) continue;
      if (end && d >= end) continue;

      // Reports are usually expense-focused. Adjust if you want income too.
      if (t.type !== 'expense') continue;

      const cat = String(t.category || 'Uncategorised').trim();
      const amt = Math.abs(Number(t.amount) || 0);

      total += amt;
      byCat[cat] = (byCat[cat] || 0) + amt;
    }

    const list = Object.entries(byCat)
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);

    return { totalExpense: total, categories: list };
  }, [txs, range]);

  const periodLabel = useMemo(() => {
    if (period === 'thisMonth') return 'This month';
    if (period === 'lastMonth') return 'Last month';
    if (period === 'allTime') return 'All time';
    if (period === 'month') return formatDisplayMonth(monthKey);
    return period;
  }, [period, monthKey]);

  const openCategory = (categoryKey: string) => {
    if (period === 'month') {
      navigation.navigate('ReportDetail', { categoryKey, period, monthKey });
    } else {
      navigation.navigate('ReportDetail', { categoryKey, period });
    }
  };

  const openAll = () => {
    if (period === 'month') {
      navigation.navigate('ReportDetail', { categoryKey: 'all', period, monthKey });
    } else {
      navigation.navigate('ReportDetail', { categoryKey: 'all', period });
    }
  };

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Reports</Text>
            <Text style={styles.subtle}>{periodLabel}</Text>
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

        {/* Month switcher (only for period === 'month') */}
        {period === 'month' ? (
          <View style={styles.monthRow}>
            <Pressable
              style={styles.monthBtn}
              onPress={() => setMonthKey((mk) => addMonths(mk, -1))}
              hitSlop={8}
            >
              <Text style={styles.monthBtnText}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>{formatDisplayMonth(monthKey)}</Text>

            <Pressable
              style={styles.monthBtn}
              onPress={() => setMonthKey((mk) => addMonths(mk, +1))}
              hitSlop={8}
            >
              <Text style={styles.monthBtnText}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Spending</Text>
            <Pressable onPress={openAll} hitSlop={8}>
              <Text style={styles.cardLink}>View all</Text>
            </Pressable>
          </View>

          <Text style={styles.bigMoney}>{formatMoney(totalExpense)}</Text>
          <Text style={styles.subtle}>Total expenses for {periodLabel.toLowerCase()}</Text>
        </View>

        {/* Category breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top categories</Text>

          {categories.length === 0 ? (
            <Text style={styles.subtle}>No expenses found for this period.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              {categories.slice(0, 12).map((c) => {
                const pct = totalExpense > 0 ? Math.round((c.value / totalExpense) * 100) : 0;
                return (
                  <Pressable
                    key={c.key}
                    style={styles.catRow}
                    onPress={() => openCategory(c.key)}
                    hitSlop={6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catTitle}>{c.key}</Text>
                      <Text style={styles.catSub}>
                        {formatMoney(c.value)} • {pct}%
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                );
              })}

              {categories.length > 12 ? (
                <Text style={[styles.subtle, { marginTop: 8 }]}>
                  Showing top 12 categories (tap “View all” to see every transaction).
                </Text>
              ) : null}
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
  periodBtnActive: { backgroundColor: theme.card, borderColor: theme.link },
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  cardLink: { color: theme.link, fontSize: 13, fontWeight: '700' },

  bigMoney: { color: theme.text, fontSize: 28, fontWeight: '900', marginTop: 2 },

  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  catTitle: { color: theme.text, fontWeight: '800' },
  catSub: { color: theme.textDim, fontSize: 12, marginTop: 2 },

  chevron: { color: theme.link, fontSize: 22, paddingLeft: 6 },
});
