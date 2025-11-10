// src/screens/ReportsScreen.tsx
import React, { useMemo } from 'react';
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

export default function ReportsScreen({ navigation }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];
  const accounts = state.accounts || [];

  // Current month key: "YYYY-MM"
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel = now.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const byId: Record<string, string> = {};
  accounts.forEach(a => {
    byId[a.id] = a.name || 'Account';
  });

  const txsThisMonth = useMemo(
    () => txs.filter(t => (t.date || '').startsWith(monthKey)),
    [txs, monthKey]
  );

  const { income, expense, net } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txsThisMonth) {
      const amt = Number(t.amount || 0);
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [txsThisMonth]);

  const topExpenses = useMemo(
    () =>
      txsThisMonth
        .filter(t => t.type !== 'income')
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 5),
    [txsThisMonth]
  );

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Reports</Text>
          <Text style={styles.subtle}>Overview for {monthLabel}</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
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
          Based on {txsThisMonth.length} transaction
          {txsThisMonth.length === 1 ? '' : 's'} this month.
        </Text>
      </View>

      {/* Top expenses */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>Top expenses this month</Text>
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
                <Text style={styles.rowAmount}>
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
    marginBottom: 16,
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
    color: '#F97373',
    fontWeight: '700',
  },
});
