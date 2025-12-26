// src/screens/BudgetsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

type SortMode = 'status' | 'largestRemaining' | 'a-z';
type Status = 'ok' | 'warning' | 'exceeded';

type BudgetLike = {
  id: string;
  category: string;
  limit: number;
};

function formatGBP(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
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
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

const normCat = (s?: string) => (s || 'Uncategorised').trim().toLowerCase();

function getBudgetStatus(spent: number, limit: number): Status {
  if (limit <= 0) return 'ok';
  if (spent >= limit) return 'exceeded';
  if (spent >= limit * 0.8) return 'warning';
  return 'ok';
}

export default function BudgetsScreen({ navigation }: any) {
  const { state } = useApp();
  const budgets: BudgetLike[] = (state as any).budgets || [];
  const txs = state.transactions || [];

  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [sortMode, setSortMode] = useState<SortMode>('status');

  const monthRange = useMemo(() => {
    const start = startOfMonth(activeMonth);
    const end = startOfNextMonth(activeMonth);
    return { start, end };
  }, [activeMonth]);

  // Spend by category for selected month (expenses only)
  const spentByCategory = useMemo(() => {
    const { start, end } = monthRange;
    const map: Record<string, number> = {};

    for (const t of txs) {
      if (!t?.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d >= end) continue;

      if (t.type !== 'expense') continue;

      const key = normCat(t.category);
      map[key] = (map[key] || 0) + Math.abs(Number(t.amount) || 0);
    }

    return map;
  }, [txs, monthRange]);

  // Build per-budget view model
  const budgetRows = useMemo(() => {
    const rows = budgets.map((b) => {
      const category = (b.category || 'Uncategorised').trim() || 'Uncategorised';
      const limit = Number(b.limit) || 0;

      const key = normCat(category);
      const spent = spentByCategory[key] || 0;

      const remaining = limit - spent;
      const status = getBudgetStatus(spent, limit);
      const progress = clamp01(limit > 0 ? spent / limit : 0);

      return {
        id: b.id,
        category,
        limit,
        spent,
        remaining,
        status,
        progress,
      };
    });

    if (sortMode === 'a-z') {
      rows.sort((a, b) => a.category.localeCompare(b.category));
    } else if (sortMode === 'largestRemaining') {
      rows.sort((a, b) => b.remaining - a.remaining);
    } else {
      const rank = (s: Status) => (s === 'exceeded' ? 0 : s === 'warning' ? 1 : 2);
      rows.sort((a, b) => rank(a.status) - rank(b.status) || b.progress - a.progress);
    }

    return rows;
  }, [budgets, spentByCategory, sortMode]);

  const summary = useMemo(() => {
    let exceeded = 0;
    let warning = 0;
    let totalRemaining = 0;

    for (const r of budgetRows) {
      if (r.status === 'exceeded') exceeded += 1;
      else if (r.status === 'warning') warning += 1;
      totalRemaining += r.remaining;
    }

    return { exceeded, warning, totalRemaining };
  }, [budgetRows]);

  const onAddBudget = () => navigation.navigate('BudgetEditor', { mode: 'create' });
  const onEditBudget = (id: string) => navigation.navigate('BudgetEditor', { id });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Budgets</Text>
            <Text style={styles.subtle}>{monthLabel(activeMonth)}</Text>
          </View>

          <View style={styles.headerPillsRow}>
            <Pressable style={styles.headerPill} onPress={onAddBudget} hitSlop={8}>
              <Text style={styles.headerPillText}>+ Add</Text>
            </Pressable>

            <Pressable style={styles.headerPill} onPress={() => navigation?.goBack?.()} hitSlop={8}>
              <Text style={styles.headerPillText}>Back</Text>
            </Pressable>
          </View>
        </View>

        {/* Month navigation */}
        <View style={styles.headerPillsRow}>
          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth((m) => addMonths(m, -1))}
            hitSlop={8}
          >
            <Text style={styles.headerPillText}>◀ Prev</Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth(() => startOfMonth(new Date()))}
            hitSlop={8}
          >
            <Text style={styles.headerPillText}>This month</Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth((m) => addMonths(m, 1))}
            hitSlop={8}
          >
            <Text style={styles.headerPillText}>Next ▶</Text>
          </Pressable>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <Text style={styles.summaryTitle}>Budget status</Text>

            {summary.exceeded > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{summary.exceeded}</Text>
              </View>
            )}
          </View>

          {budgets.length === 0 ? (
            <View>
              <Text style={styles.emptyText}>No budgets set yet.</Text>

              <Pressable
                style={[styles.headerPill, { marginTop: 10, alignSelf: 'flex-start' }]}
                onPress={onAddBudget}
                hitSlop={8}
              >
                <Text style={styles.headerPillText}>+ Add budget</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.subtle}>
              {summary.exceeded} exceeded • {summary.warning} near limit • Remaining{' '}
              <Text style={{ color: theme.text, fontWeight: '800' }}>
                {formatGBP(summary.totalRemaining)}
              </Text>
            </Text>
          )}
        </View>

        {/* List card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Your budgets</Text>

            <Pressable
              style={styles.smallBtn}
              onPress={() =>
                setSortMode((m) =>
                  m === 'status' ? 'a-z' : m === 'a-z' ? 'largestRemaining' : 'status'
                )
              }
              hitSlop={8}
            >
              <Text style={styles.smallBtnText}>
                Sort:{' '}
                {sortMode === 'status'
                  ? 'Status'
                  : sortMode === 'a-z'
                  ? 'A–Z'
                  : 'Remaining'}
              </Text>
            </Pressable>
          </View>

          {budgets.length === 0 ? (
            <Text style={styles.emptyText}>Create a budget to start tracking spending.</Text>
          ) : (
            budgetRows.map((r) => (
              <Pressable
                key={r.id}
                style={styles.budgetRow}
                onPress={() => onEditBudget(r.id)}
                hitSlop={6}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetCategory} numberOfLines={1}>
                    {r.category}
                  </Text>

                  <Text style={styles.budgetMeta} numberOfLines={1}>
                    Spent {formatGBP(r.spent)} · Limit {formatGBP(r.limit)}
                  </Text>

                  <Text
                    style={[
                      styles.budgetRemaining,
                      r.status === 'exceeded'
                        ? styles.dangerText
                        : r.status === 'warning'
                        ? styles.warnText
                        : styles.okText,
                    ]}
                    numberOfLines={1}
                  >
                    {r.status === 'exceeded'
                      ? `Exceeded by ${formatGBP(r.spent - r.limit)}`
                      : `Remaining ${formatGBP(r.limit - r.spent)}`}
                  </Text>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        r.status === 'exceeded'
                          ? styles.progressFillExceeded
                          : r.status === 'warning'
                          ? styles.progressFillWarning
                          : styles.progressFillOk,
                        { width: `${Math.round(r.progress * 100)}%` },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  wrap: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 24 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 10,
  },
  h1: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  subtle: { color: theme.textDim, marginTop: 4 },

  headerPillsRow: { flexDirection: 'row', columnGap: 8, marginBottom: 14 },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: theme.card,
  },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },

  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryTitle: { color: '#E5E7EB', fontWeight: '700', fontSize: 16 },

  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  smallBtnText: { color: theme.pillText, fontWeight: '700', fontSize: 13 },

  emptyText: { color: theme.textDim, marginTop: 10 },

  // Budget row (polished)
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    marginTop: 8,
  },
  budgetCategory: { color: theme.text, fontWeight: '800' },
  budgetMeta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  budgetRemaining: { marginTop: 6, fontWeight: '700' },

  okText: { color: theme.positive },
  warnText: { color: '#FBBF24' },
  dangerText: { color: theme.negative },

  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    marginTop: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  progressFillOk: { backgroundColor: theme.link },
  progressFillWarning: { backgroundColor: '#FBBF24' },
  progressFillExceeded: { backgroundColor: theme.negative },

  chevron: { color: theme.link, fontSize: 22, paddingLeft: 10 },

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
  },
  badgeText: { color: 'white', fontWeight: '800', fontSize: 12 },
});
