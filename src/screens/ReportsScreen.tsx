// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

type SortMode = 'largest' | 'a-z';

function formatGBP(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(v);
  } catch {
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return `${sign}£${abs.toFixed(2)}`;
  }
}

function clamp01(x: number) {
  if (!isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}
function monthLabel(d: Date) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}
function monthKeyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // YYYY-MM
}

export default function ReportsScreen({ navigation }: any) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const [sortMode, setSortMode] = useState<SortMode>('largest');
  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));

  const monthKey = useMemo(() => monthKeyFromDate(activeMonth), [activeMonth]);

  const monthRange = useMemo(() => {
    const start = startOfMonth(activeMonth);
    const end = startOfNextMonth(activeMonth);
    return { start, end };
  }, [activeMonth]);

  // ---- Monthly totals ----
  const monthSummary = useMemo(() => {
    const { start, end } = monthRange;

    let income = 0;
    let expense = 0;

    for (const t of txs) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d >= end) continue;

      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }

    return { income, expense, net: income - expense };
  }, [txs, monthRange]);

  // ---- Category breakdown (selected month): income/expense/net ----
  const categoryBreakdown = useMemo(() => {
    const { start, end } = monthRange;
    const map: Record<string, { expense: number; income: number }> = {};

    for (const t of txs) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d >= end) continue;

      const key = (t.category || 'Uncategorised').trim() || 'Uncategorised';
      if (!map[key]) map[key] = { expense: 0, income: 0 };

      const amt = Number(t.amount) || 0;
      if (t.type === 'expense') map[key].expense += amt;
      if (t.type === 'income') map[key].income += amt;
    }

    const rows = Object.entries(map).map(([categoryKey, v]) => ({
      categoryKey,
      expense: v.expense,
      income: v.income,
      net: v.income - v.expense,
    }));

    // Default sort: largest expense first (most useful)
    rows.sort((a, b) => b.expense - a.expense);

    return rows;
  }, [txs, monthRange]);

  // ---- Spent by category (expenses only) for bar chart ----
  const spentByCategory = useMemo(() => {
    const { start, end } = monthRange;
    const map: Record<string, number> = {};

    for (const t of txs) {
      if (t.type !== 'expense') continue;
      if (!t.date) continue;

      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d >= end) continue;

      const catRaw = (t.category || '').trim();
      const cat = catRaw ? catRaw : 'Uncategorised';

      const amt = Number(t.amount) || 0;
      map[cat] = (map[cat] || 0) + amt;
    }

    return map;
  }, [txs, monthRange]);

  const totalSpent = useMemo(() => {
    return Object.values(spentByCategory || {}).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0
    );
  }, [spentByCategory]);

  const chartRows = useMemo(() => {
    const entries = Object.entries(spentByCategory || {})
      .map(([category, amount]) => ({
        category: category || 'Uncategorised',
        amount: Number(amount) || 0,
      }))
      .filter((r) => r.amount > 0);

    if (sortMode === 'a-z') entries.sort((a, b) => a.category.localeCompare(b.category));
    else entries.sort((a, b) => b.amount - a.amount);

    const max = entries.length ? entries[0].amount : 0;

    return entries.map((r) => {
      const pct = totalSpent > 0 ? r.amount / totalSpent : 0;
      const bar = max > 0 ? r.amount / max : 0;
      return { ...r, pct: clamp01(pct), bar: clamp01(bar) };
    });
  }, [spentByCategory, sortMode, totalSpent]);

  const noTxsThisMonth =
    (monthSummary.income || 0) === 0 && (monthSummary.expense || 0) === 0;

  const netIsPositive = (monthSummary.net || 0) >= 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Reports</Text>
            <Text style={styles.subtle}>{monthLabel(activeMonth)}</Text>
          </View>
        </View>

        {/* Month nav pills */}
        <View style={styles.headerPillsRow}>
          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth((m) => addMonths(m, -1))}
          >
            <Text style={styles.headerPillText}>◀ Prev</Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth(() => startOfMonth(new Date()))}
          >
            <Text style={styles.headerPillText}>This month</Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth((m) => addMonths(m, 1))}
          >
            <Text style={styles.headerPillText}>Next ▶</Text>
          </Pressable>
        </View>

        {/* Category breakdown (drill-through) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category breakdown</Text>
          <Text style={styles.subtle}>Tap a category to drill into transactions.</Text>

          {categoryBreakdown.length === 0 ? (
            <Text style={styles.emptyText}>No transactions in this month.</Text>
          ) : (
            categoryBreakdown.map((r) => (
              <Pressable
                key={r.categoryKey}
                onPress={() =>
                  navigation.navigate('ReportDetail', {
                    categoryKey: r.categoryKey,
                    period: 'month',
                    monthKey, // YYYY-MM
                  })
                }
                style={styles.txRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{r.categoryKey}</Text>
                  <Text style={styles.txMeta}>
                    Spent {formatGBP(r.expense)} • Income {formatGBP(r.income)}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.txAmount,
                    r.net >= 0 ? styles.positiveText : styles.negativeText,
                  ]}
                >
                  {r.net >= 0 ? '+' : '-'}
                  {formatGBP(Math.abs(r.net))}
                </Text>

                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
        </View>

        {/* SUMMARY CARD */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>

          {noTxsThisMonth ? (
            <Text style={styles.emptyText}>No transactions recorded for this month yet.</Text>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text style={styles.summaryValue}>{formatGBP(monthSummary.income)}</Text>
                  <Text style={styles.summarySub}>Total income</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text style={styles.summaryValue}>{formatGBP(monthSummary.expense)}</Text>
                  <Text style={styles.summarySub}>Total expenses</Text>
                </View>
              </View>

              <View style={{ height: 10 }} />

              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Net</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      netIsPositive ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {formatGBP(monthSummary.net)}
                  </Text>
                  <Text style={styles.summarySub}>Income minus expenses</Text>
                </View>
                <View style={styles.summaryItem} />
              </View>
            </>
          )}
        </View>

        {/* CATEGORY CARD (bar chart) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Spending by category</Text>

            <Pressable
              style={styles.smallBtn}
              onPress={() => setSortMode((m) => (m === 'largest' ? 'a-z' : 'largest'))}
            >
              <Text style={styles.smallBtnText}>
                Sort: {sortMode === 'largest' ? 'Largest' : 'A–Z'}
              </Text>
            </Pressable>
          </View>

          {totalSpent <= 0 ? (
            <Text style={styles.emptyText}>No expenses this month (yet).</Text>
          ) : chartRows.length === 0 ? (
            <Text style={styles.emptyText}>No categorised spending to display.</Text>
          ) : (
            <>
              <Text style={styles.subtle}>
                Total spent:{' '}
                <Text style={{ color: '#F9FAFB', fontWeight: '800' }}>
                  {formatGBP(totalSpent)}
                </Text>
              </Text>

              {chartRows.map((r) => (
                <View key={r.category} style={styles.catRow}>
                  <View style={styles.catTopLine}>
                    <Text style={styles.upcomingTitle} numberOfLines={1}>
                      {r.category}
                    </Text>

                    <Text style={styles.upcomingAmount}>
                      {formatGBP(r.amount)}{' '}
                      <Text style={styles.catPct}>({Math.round(r.pct * 100)}%)</Text>
                    </Text>
                  </View>

                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${Math.round(r.bar * 100)}%` }]}
                    />
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  wrap: {
    padding: 16,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 10,
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
    marginBottom: 14,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  headerPillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },

  summaryCard: {
    backgroundColor: '#0B1020',
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
  summaryItem: {
    flex: 1,
  },
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
  positiveText: {
    color: '#22C55E',
  },
  negativeText: {
    color: '#F97373',
  },

  card: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  smallBtnText: {
    color: '#BFDBFE',
    fontWeight: '700',
    fontSize: 13,
  },

  emptyText: {
    color: '#9CA3AF',
    marginTop: 10,
  },

  // Drill-through list row styling (matches your Payments style)
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
    marginTop: 8,
  },
  txTitle: { color: '#F9FAFB', fontWeight: '800' },
  txMeta: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  txAmount: { fontWeight: '800' },
  chevron: { color: '#93C5FD', fontSize: 22, marginTop: 2 },

  catRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
    marginTop: 8,
  },
  catTopLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  upcomingTitle: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  upcomingAmount: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginLeft: 8,
  },
  catPct: {
    color: '#9CA3AF',
    fontWeight: '700',
  },

  barTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 8,
  },
  barFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#93C5FD',
  },
});
