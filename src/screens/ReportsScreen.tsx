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
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

type RangeKey = 'this' | 'last' | 'last3';

export default function ReportsScreen({ navigation }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];
  const accounts = state.accounts || [];

  const [range, setRange] = useState<RangeKey>('this');

  // ---- Date / range helpers ----
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  function monthKeyOf(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  const thisMonthKey = monthKeyOf(year, month);

  let lastMonthYear = year;
  let lastMonth = month - 1;
  if (lastMonth === 0) {
    lastMonth = 12;
    lastMonthYear = year - 1;
  }
  const lastMonthKey = monthKeyOf(lastMonthYear, lastMonth);

  const last3Keys: string[] = (() => {
    const keys: string[] = [];
    let y = year;
    let m = month;
    for (let i = 0; i < 3; i++) {
      keys.push(monthKeyOf(y, m));
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return keys;
  })();

  const { monthLabel, selectedKeys } = useMemo(() => {
    switch (range) {
      case 'this':
        return {
          monthLabel: now.toLocaleString(undefined, {
            month: 'long',
            year: 'numeric',
          }),
          selectedKeys: [thisMonthKey],
        };
      case 'last': {
        const d = new Date(lastMonthYear, lastMonth - 1, 1);
        return {
          monthLabel: d.toLocaleString(undefined, {
            month: 'long',
            year: 'numeric',
          }),
          selectedKeys: [lastMonthKey],
        };
      }
      case 'last3':
      default:
        return {
          monthLabel: 'Last 3 months',
          selectedKeys: last3Keys,
        };
    }
  }, [range, thisMonthKey, lastMonthKey, last3Keys, lastMonth, lastMonthYear, now]);

  // ---- Filter txs by selected period ----
  const txsInRange = useMemo(
    () =>
      txs.filter(t => {
        const d = t.date || '';
        const key = d.slice(0, 7); // "YYYY-MM"
        return selectedKeys.includes(key);
      }),
    [txs, selectedKeys]
  );

  const { income, expense, net } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txsInRange) {
      const amt = Number(t.amount || 0);
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [txsInRange]);

  // ---- Top 5 expenses in range ----
  const topExpenses = useMemo(
    () =>
      txsInRange
        .filter(t => t.type !== 'income')
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 5),
    [txsInRange]
  );

  // ---- Per-account net in range ----
  const byId: Record<string, string> = {};
  accounts.forEach(a => {
    byId[a.id] = a.name || 'Account';
  });

  const perAccount = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const t of txsInRange) {
      const id = t.accountId;
      if (!map[id]) map[id] = { income: 0, expense: 0 };
      const amt = Number(t.amount || 0);
      if (t.type === 'income') map[id].income += amt;
      else map[id].expense += amt;
    }
    const rows = Object.entries(map).map(([id, v]) => ({
      id,
      name: byId[id] || 'Account',
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    // sort by absolute net (biggest impact first)
    rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    return rows;
  }, [txsInRange, byId]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Reports</Text>
          <Text style={styles.subtle}>{monthLabel}</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
      </View>

      {/* Range selector */}
      <View style={styles.rangeRow}>
        <Pressable
          style={[
            styles.rangePill,
            range === 'this' && styles.rangePillActive,
          ]}
          onPress={() => setRange('this')}
        >
          <Text
            style={[
              styles.rangeText,
              range === 'this' && styles.rangeTextActive,
            ]}
          >
            This month
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.rangePill,
            range === 'last' && styles.rangePillActive,
          ]}
          onPress={() => setRange('last')}
        >
          <Text
            style={[
              styles.rangeText,
              range === 'last' && styles.rangeTextActive,
            ]}
          >
            Last month
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.rangePill,
            range === 'last3' && styles.rangePillActive,
          ]}
          onPress={() => setRange('last3')}
        >
          <Text
            style={[
              styles.rangeText,
              range === 'last3' && styles.rangeTextActive,
            ]}
          >
            Last 3 months
          </Text>
        </Pressable>
      </View>

      {/* Summary cards */}
      <View style={styles.cardsRow}>
        <View style={[styles.card, styles.cardGood]}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={styles.cardValue}>£{income.toFixed(2)}</Text>
        </View>
        <View style={[styles.card, styles.cardBad]}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={styles.cardValue}>£{expense.toFixed(2)}</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.cardLabel}>Net</Text>
        <Text
          style={[
            styles.cardValue,
            net >= 0 ? styles.netPos : styles.netNeg,
          ]}
        >
          {net >= 0 ? '+' : '-'}£{Math.abs(net).toFixed(2)}
        </Text>
        <Text style={styles.subtleSmall}>
          Based on {txsInRange.length} transaction
          {txsInRange.length === 1 ? '' : 's'} in this range.
        </Text>
      </View>

      {/* Per-account net */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>By account</Text>
        {perAccount.length === 0 ? (
          <Text style={styles.subtleSmall}>
            No activity for this range yet.
          </Text>
        ) : (
          perAccount.map(row => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{row.name}</Text>
                <Text style={styles.rowSub}>
                  Income £{row.income.toFixed(2)} · Expense £
                  {row.expense.toFixed(2)}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  row.net >= 0 ? styles.rowAmountIncome : styles.rowAmountExpense,
                ]}
              >
                {row.net >= 0 ? '+' : '-'}£{Math.abs(row.net).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Top expenses */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>Top expenses in range</Text>
        {topExpenses.length === 0 ? (
          <Text style={styles.subtleSmall}>No expenses recorded yet.</Text>
        ) : (
          topExpenses.map(tx => {
            const accName = byId[tx.accountId] || 'Account';
            const amt = Number(tx.amount || 0);
            const d = tx.date ? new Date(`${tx.date}T00:00:00`) : null;
            return (
              <View key={String(tx.id)} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowTitle}>
                    {tx.note || 'Expense'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {accName}
                    {d ? ` · ${d.toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, styles.rowAmountExpense]}>
                  -£{amt.toFixed(2)}
                </Text>
              </View>
            );
          })
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  subtleSmall: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  backLink: {
    color: '#93C5FD',
    fontWeight: '600',
  },

  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  rangePillActive: {
    backgroundColor: '#2563EB',
  },
  rangeText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  rangeTextActive: {
    color: '#F9FAFB',
  },

  cardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
  },
  cardGood: {
    borderColor: '#22C55E33',
    borderWidth: 1,
  },
  cardBad: {
    borderColor: '#F9737333',
    borderWidth: 1,
  },
  cardLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4,
  },
  cardValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  netPos: {
    color: '#4ADE80',
  },
  netNeg: {
    color: '#F97373',
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1F2937',
  },
  rowLeft: {
    flexShrink: 1,
    paddingRight: 8,
  },
  rowTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  rowSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowAmountIncome: {
    color: '#4ADE80',
  },
  rowAmountExpense: {
    color: '#F97373',
  },
});
