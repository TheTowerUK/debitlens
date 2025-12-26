// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
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
import { colors as theme } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthKeyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // YYYY-MM
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function rangeForMonth(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

function formatMonthLabel(d: Date) {
  try {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return monthKeyFromDate(d);
  }
}

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

export default function ReportsScreen({ navigation }: Props) {
  const { state } = useApp();
  const txs: Transaction[] = state.transactions || [];

  const [activeMonth, setActiveMonth] = useState<Date>(() => startOfMonth(new Date()));

  const { start, end } = useMemo(() => rangeForMonth(activeMonth), [activeMonth]);
  const activeMonthKey = useMemo(() => monthKeyFromDate(activeMonth), [activeMonth]);
  const activeMonthLabel = useMemo(() => formatMonthLabel(activeMonth), [activeMonth]);

  const monthTxs = useMemo(() => {
    return (txs || []).filter((t) => {
      if (!t?.date) return false;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      return d >= start && d < end;
    });
  }, [txs, start, end]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of monthTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }

    return { income, expense, net: income - expense };
  }, [monthTxs]);

  const rows = useMemo(() => {
    // category -> totals
    const map = new Map<
      string,
      { category: string; income: number; expense: number; net: number; count: number }
    >();

    for (const t of monthTxs) {
      const category = (t.category ?? 'Uncategorised').trim() || 'Uncategorised';
      const current = map.get(category) || {
        category,
        income: 0,
        expense: 0,
        net: 0,
        count: 0,
      };

      const amt = Number(t.amount) || 0;
      if (t.type === 'income') current.income += amt;
      else if (t.type === 'expense') current.expense += amt;

      current.net = current.income - current.expense;
      current.count += 1;

      map.set(category, current);
    }

    // sort: highest absolute net first
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [monthTxs]);

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Reports</Text>
            <Text style={styles.subtle}>Month: {activeMonthLabel}</Text>
          </View>
        </View>

        {/* Month pills + Back aligned right */}
        <View style={styles.headerPillsRow}>
          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth((m) => addMonths(m, -1))}
          >
            <Text style={styles.headerPillText}>◀ Prev </Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth(() => startOfMonth(new Date()))}
          >
            <Text style={styles.headerPillText}>This month </Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => setActiveMonth((m) => addMonths(m, 1))}
          >
            <Text style={styles.headerPillText}>Next ▶ </Text>
          </Pressable>

          <Pressable
            style={[styles.headerPill, { marginLeft: 'auto' }]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <Text style={styles.headerPillText}>Back</Text>
          </Pressable>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={[styles.summaryValue, styles.positiveText]}>
                {formatGBP(summary.income)}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={[styles.summaryValue, styles.negativeText]}>
                {formatGBP(summary.expense)}
              </Text>
            </View>
          </View>

          <View style={{ height: 10 }} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text
                style={[
                  styles.summaryValue,
                  summary.net >= 0 ? styles.positiveText : styles.negativeText,
                ]}
              >
                {formatGBP(summary.net)}
              </Text>
              <Text style={styles.summarySub}>
                {monthTxs.length} transaction{monthTxs.length === 1 ? '' : 's'} in this month
              </Text>
            </View>
            <View style={styles.summaryItem} />
          </View>
        </View>

        {/* Categories */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>By category</Text>
            <Text style={styles.cardLink}>Tap to drill in</Text>
          </View>

          {rows.length === 0 ? (
            <Text style={styles.emptyText}>No transactions in this month.</Text>
          ) : (
            rows.map((r) => {
              const netStyle = r.net >= 0 ? styles.positiveText : styles.negativeText;
              return (
                <Pressable
                  key={r.category}
                  style={styles.accountRow}
                  onPress={() =>
                    navigation.navigate('ReportDetail', {
                      categoryKey: r.category,
                      period: 'month',
                      monthKey: activeMonthKey,
                    })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{r.category}</Text>
                    <Text style={[styles.accountMeta, styles.accountMetaDim]}>
                      {r.count} tx • Income {formatGBP(r.income)} • Expense {formatGBP(r.expense)}
                    </Text>
                  </View>

                  <Text style={[styles.accountBalance, netStyle]}>{formatGBP(r.net)}</Text>
                  <Text style={styles.accountChevron}>›</Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    flex: 1,
    backgroundColor: 'theme.bg',
  },
  wrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 24 : 20,
    paddingBottom: 32,
  },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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

  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },

  // SUMMARY CARD
  summaryCard: {
    backgroundColor: theme.card,
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

  // CARD
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
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardLink: {
    color: theme.link,
    fontSize: 13,
    fontWeight: '600',
  },

  emptyText: {
    color: theme.textDim,
    marginTop: 10,
  },

  // ROWS (reusing your "accounts" row styling pattern)
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  accountName: {
    color: theme.text,
    fontWeight: '800',
  },
  accountMeta: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  accountMetaDim: { opacity: 0.8 },

  accountBalance: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginRight: 6,
  },
  accountChevron: {
    color: theme.link,
    fontSize: 22,
    paddingLeft: 6,
  },
});
