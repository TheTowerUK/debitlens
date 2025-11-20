// src/screens/ReportsScreen.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useApp } from '../state/AppProvider';

export default function ReportsScreen() {
  const { state } = useApp();
  const txs = state.transactions ?? [];
  const accounts = state.accounts ?? [];

  const {
    totalIncome,
    totalExpense,
    net,
    byCategory,
    byAccount,
  } = useMemo(() => {
    let income = 0;
    let expense = 0;

    const catMap: Record<string, { income: number; expense: number }> = {};
    const accMap: Record<string, { income: number; expense: number }> = {};

    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      const cat = t.category || 'Uncategorised';
      const acc = t.accountId || 'unknown';

      // init maps
      catMap[cat] ??= { income: 0, expense: 0 };
      accMap[acc] ??= { income: 0, expense: 0 };

      if (t.type === 'income') {
        income += amt;
        catMap[cat].income += amt;
        accMap[acc].income += amt;
      } else {
        expense += amt;
        catMap[cat].expense += amt;
        accMap[acc].expense += amt;
      }
    }

    return {
      totalIncome: income,
      totalExpense: expense,
      net: income - expense,
      byCategory: catMap,
      byAccount: accMap,
    };
  }, [txs]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 48 }}>
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>Overview of your spending and income.</Text>

      {/* SUMMARY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Summary</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total Income</Text>
          <Text style={[styles.value, styles.income]}>£{totalIncome.toFixed(2)}</Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total Expenses</Text>
          <Text style={[styles.value, styles.expense]}>£{totalExpense.toFixed(2)}</Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Net</Text>
          <Text
            style={[
              styles.value,
              net >= 0 ? styles.income : styles.expense,
            ]}
          >
            £{net.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* CATEGORY BREAKDOWN */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>By Category</Text>
        {Object.entries(byCategory).map(([cat, vals]) => (
          <View style={styles.rowBetween} key={cat}>
            <Text style={styles.label}>{cat}</Text>
            <Text style={styles.value}>
              <Text style={styles.income}>+£{vals.income.toFixed(2)}</Text>
              <Text> / </Text>
              <Text style={styles.expense}>-£{vals.expense.toFixed(2)}</Text>
            </Text>
          </View>
        ))}
      </View>

      {/* ACCOUNT BREAKDOWN */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>By Account</Text>
        {accounts.map(acc => {
          const vals = byAccount[acc.id] ?? { income: 0, expense: 0 };
          return (
            <View style={styles.rowBetween} key={acc.id}>
              <Text style={styles.label}>{acc.name}</Text>
              <Text style={styles.value}>
                <Text style={styles.income}>+£{vals.income.toFixed(2)}</Text>
                <Text> / </Text>
                <Text style={styles.expense}>-£{vals.expense.toFixed(2)}</Text>
              </Text>
            </View>
          );
        })}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: '#9CA3AF',
  },
  value: {
    color: '#F3F4F6',
    fontWeight: '700',
  },
  income: { color: '#22C55E' },
  expense: { color: '#F97373' },
});
