// src/screens/BudgetsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

type SortMode = 'status' | 'largestRemaining' | 'a-z';
type Status = 'ok' | 'warning' | 'exceeded';

type BudgetLike = {
  id: string;
  name?: string;
  category?: string;
  limit: number;
};

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
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

export default function BudgetsScreen({ navigation }: any) {
  const { state } = useApp();
  const budgets: BudgetLike[] = (state as any).budgets || [];
  const txs = state.transactions || [];

  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [sortMode, setSortMode] = useState<SortMode>('status');

  /**
   * ✅ safeNavigate that works with nested navigators:
   * It walks up parent navigators until it finds one that owns the route.
   */
  const safeNavigate = (routeNames: string[], params?: any) => {
    let nav: any = navigation;

    while (nav) {
      const available: string[] = nav?.getState?.()?.routeNames ?? [];

      for (const name of routeNames) {
        if (available.includes(name)) {
          nav.navigate(name, params);
          return;
        }
      }

      nav = nav.getParent?.();
    }

    // If nothing matched, do nothing (prevents NAVIGATE error)
    // console.warn('No matching route found for:', routeNames);
  };

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

  // Build per-budget view model
  const budgetRows = useMemo(() => {
    const warningThreshold = 0.15; // <= 15% remaining

    const rows = budgets.map((b) => {
      const cat = (b.category || 'Uncategorised').trim() || 'Uncategorised';
      const limit = Number((b as any).limit) || 0;
      const spent = Number(spentByCategory[cat]) || 0;
      const remaining = limit - spent;

      let status: Status = 'ok';
      if (limit > 0 && remaining < 0) status = 'exceeded';
      else if (limit > 0 && remaining / limit <= warningThreshold) status = 'warning';

      const usedPct = limit > 0 ? spent / limit : 0;

      return {
        id: b.id,
        name: (b.name || cat).trim() || cat,
        category: cat,
        limit,
        spent,
        remaining,
        status,
        usedPct: clamp01(usedPct),
      };
    });

    if (sortMode === 'a-z') {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === 'largestRemaining') {
      rows.sort((a, b) => b.remaining - a.remaining);
    } else {
      const rank = (s: Status) => (s === 'exceeded' ? 0 : s === 'warning' ? 1 : 2);
      rows.sort((a, b) => rank(a.status) - rank(b.status) || b.usedPct - a.usedPct);
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
            <Pressable
              style={styles.headerPill}
              onPress={() =>
                safeNavigate(['AddBudget', 'BudgetEditor', 'BudgetEditorScreen'], { mode: 'create' })
              }
            >
              <Text style={styles.headerPillText}>+ Add</Text>
            </Pressable>

            <Pressable style={styles.headerPill} onPress={() => navigation?.goBack?.()}>
              <Text style={styles.headerPillText}>Back</Text>
            </Pressable>
          </View>
        </View>

        {/* Month navigation */}
        <View style={styles.headerPillsRow}>
          <Pressable style={styles.headerPill} onPress={() => setActiveMonth((m) => addMonths(m, -1))}>
            <Text style={styles.headerPillText}>◀ Prev</Text>
          </Pressable>

          <Pressable style={styles.headerPill} onPress={() => setActiveMonth(() => startOfMonth(new Date()))}>
            <Text style={styles.headerPillText}>This month</Text>
          </Pressable>

          <Pressable style={styles.headerPill} onPress={() => setActiveMonth((m) => addMonths(m, 1))}>
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
                onPress={() =>
                  safeNavigate(['AddBudget', 'BudgetEditor', 'BudgetEditorScreen'], { mode: 'create' })
                }
              >
                <Text style={styles.headerPillText}>+ Add budget</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.subtle}>
              {summary.exceeded} exceeded • {summary.warning} near limit • Remaining{' '}
              <Text style={{ color: '#F9FAFB', fontWeight: '800' }}>
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
              <View key={r.id} style={styles.budgetRow}>
                <View style={styles.budgetTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.budgetName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={styles.budgetMeta} numberOfLines={1}>
                      {r.category} • Limit {formatGBP(r.limit)}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.budgetAmount}>Spent {formatGBP(r.spent)}</Text>

                    <Text
                      style={[
                        styles.budgetMeta,
                        r.status === 'exceeded'
                          ? styles.negativeText
                          : r.status === 'warning'
                          ? styles.warningText
                          : styles.positiveText,
                      ]}
                    >
                      {r.status === 'exceeded'
                        ? `${formatGBP(-r.remaining)} over`
                        : `${formatGBP(r.remaining)} left`}
                    </Text>

                    <Pressable
                      style={[styles.pillSmall, { marginTop: 8 }]}
                      onPress={() =>
                        safeNavigate(['BudgetEditor', 'BudgetEditorScreen'], { id: r.id })
                      }
                    >
                      <Text style={styles.pillSmallText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      r.status === 'exceeded'
                        ? styles.barFillExceeded
                        : r.status === 'warning'
                        ? styles.barFillWarning
                        : styles.barFillOk,
                      { width: `${Math.round(r.usedPct * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  wrap: { padding: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 10,
  },
  h1: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginTop: 4 },

  headerPillsRow: { flexDirection: 'row', columnGap: 8, marginBottom: 14 },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },

  summaryCard: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryTitle: { color: '#E5E7EB', fontWeight: '700', fontSize: 16 },

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
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  smallBtnText: { color: '#BFDBFE', fontWeight: '700', fontSize: 13 },

  emptyText: { color: '#9CA3AF', marginTop: 10 },

  budgetRow: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
    marginTop: 8,
  },
  budgetTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  budgetName: { color: '#F9FAFB', fontWeight: '800' },
  budgetMeta: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  budgetAmount: { color: '#E5E7EB', fontWeight: '700' },

  positiveText: { color: '#22C55E' },
  negativeText: { color: '#F97373' },
  warningText: { color: '#FBBF24' },

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

  barTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginTop: 10,
  },
  barFill: { height: 8, borderRadius: 999 },
  barFillOk: { backgroundColor: '#93C5FD' },
  barFillWarning: { backgroundColor: '#FBBF24' },
  barFillExceeded: { backgroundColor: '#F97373' },

  pillSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  pillSmallText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
  },
});
