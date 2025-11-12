// src/screens/BudgetScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;

type BudgetRow = {
  category: string;
  income: number;
  expense: number;
};

export default function BudgetScreen({}: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];

  const rows = useMemo<BudgetRow[]>(() => {
    const map = new Map<string, BudgetRow>();

    for (const t of txs) {
      const cat = t.category || 'Uncategorised';
      if (!map.has(cat)) {
        map.set(cat, { category: cat, income: 0, expense: 0 });
      }
      const row = map.get(cat)!;
      const amt = Number(t.amount) || 0;

      if (t.type === 'income') {
        row.income += amt;
      } else {
        row.expense += amt;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category),
    );
  }, [txs]);

  const totalIncome = rows.reduce((sum, r) => sum + r.income, 0);
  const totalExpense = rows.reduce((sum, r) => sum + r.expense, 0);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>
        Category view of your income and spending.
      </Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total income</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            £{totalIncome.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Total spending</Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            -£{totalExpense.toFixed(2)}
          </Text>
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyText}>
            Once you add some transactions, you&apos;ll see category
            budgets here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.category}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const net = item.income - item.expense;
            const status =
              net >= 0 ? 'Under budget' : 'Over budget';

            return (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                  <Text style={styles.caption}>
                    {status}
                  </Text>
                </View>

                <View style={styles.amountCol}>
                  <Text style={[styles.amountLine, styles.incomeText]}>
                    +£{item.income.toFixed(2)}
                  </Text>
                  <Text style={[styles.amountLine, styles.expenseText]}>
                    -£{item.expense.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.amountLine,
                      net >= 0
                        ? styles.incomeText
                        : styles.expenseText,
                    ]}
                  >
                    £{net.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
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
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  summaryBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 8,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  incomeText: {
    color: '#22C55E',
  },
  expenseText: {
    color: '#F97373',
  },
  emptyBox: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  card: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 10,
  },
  categoryText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  amountLine: {
    fontSize: 13,
    fontWeight: '700',
  },
});
