// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
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

export default function ReportsScreen({ navigation }: any) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const [sortMode, setSortMode] = useState<SortMode>('largest');

  // ---- This month range ----
  const monthRange = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = startOfNextMonth(now);
    return { start, end };
  }, []);

  // ---- Monthly totals (read-only) ----
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

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [txs, monthRange]);

  // ---- spentByCategory (this month, expenses only) ----
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
      if (!map[cat]) map[cat] = 0;
      map[cat] += amt;
    }

    return map;
  }, [txs, monthRange]);

  // ---- Option B: UX polish derived data ----
  const totalSpent = useMemo(() => {
    const vals = Object.values(spentByCategory || {});
    return vals.reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [spentByCategory]);

  const categoryRows = useMemo(() => {
    const entries = Object.entries(spentByCategory || {})
      .map(([category, amount]) => ({
        category: category || 'Uncategorised',
        amount: Number(amount) || 0,
      }))
      .filter((r) => r.amount > 0);

    if (sortMode === 'a-z') {
      entries.sort((a, b) => a.category.localeCompare(b.category));
    } else {
      entries.sort((a, b) => b.amount - a.amount);
    }

    const max = entries.length ? entries[0].amount : 0;

    return entries.map((r) => {
      const pct = totalSpent > 0 ? r.amount / totalSpent : 0;
      const bar = max > 0 ? r.amount / max : 0; // relative to top category
      return { ...r, pct: clamp01(pct), bar: clamp01(bar) };
    });
  }, [spentByCategory, sortMode, totalSpent]);

  const noTxsThisMonth =
    (monthSummary.income || 0) === 0 && (monthSummary.expense || 0) === 0;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Reports</Text>

      {/* Monthly totals */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>This month</Text>

        {noTxsThisMonth ? (
          <Text style={styles.subtle}>
            No transactions recorded for this month yet.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            <View style={styles.row}>
              <Text style={styles.label}>Income</Text>
              <Text style={styles.value}>{formatGBP(monthSummary.income)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Expenses</Text>
              <Text style={styles.value}>{formatGBP(monthSummary.expense)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={[styles.label, { fontWeight: '900', opacity: 0.95 }]}>
                Net
              </Text>
              <Text style={[styles.value, { fontWeight: '900' }]}>
                {formatGBP(monthSummary.net)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Category breakdown */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Spending by category</Text>

          <Pressable
            onPress={() => setSortMode((m) => (m === 'largest' ? 'a-z' : 'largest'))}
            style={styles.pillBtn}
          >
            <Text style={styles.pillBtnText}>
              Sort: {sortMode === 'largest' ? 'Largest' : 'A–Z'}
            </Text>
          </Pressable>
        </View>

        {totalSpent <= 0 ? (
          <Text style={styles.subtle}>No expenses this month (yet).</Text>
        ) : categoryRows.length === 0 ? (
          <Text style={styles.subtle}>No categorised spending to display.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={styles.subtle}>
              Total spent:{' '}
              <Text style={{ fontWeight: '900', opacity: 0.95 }}>
                {formatGBP(totalSpent)}
              </Text>
            </Text>

            {categoryRows.map((r) => (
              <View key={r.category} style={styles.catRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.catTopLine}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {r.category}
                    </Text>

                    <Text style={styles.catAmt}>
                      {formatGBP(r.amount)}{' '}
                      <Text style={styles.catPct}>({Math.round(r.pct * 100)}%)</Text>
                    </Text>
                  </View>

                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.round(r.bar * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* If you want a quick way back */}
      <Pressable onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    gap: 12,
  },
  h1: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtle: {
    opacity: 0.75,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    opacity: 0.8,
  },
  value: {
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pillBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  catRow: {
    flexDirection: 'row',
    gap: 10,
  },
  catTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },
  catName: {
    fontWeight: '800',
    flex: 1,
  },
  catAmt: {
    fontWeight: '800',
  },
  catPct: {
    fontWeight: '700',
    opacity: 0.7,
  },
  barTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 2,
  },
  backBtnText: {
    fontWeight: '800',
    opacity: 0.9,
  },
});
