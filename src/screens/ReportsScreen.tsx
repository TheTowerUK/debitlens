// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { useApp } from '../state/AppProvider';

type PeriodOption = {
  key: string;   // 'YYYY-MM'
  label: string; // 'Nov 2025'
};

function formatMonthLabel(year: number, monthIndex: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[monthIndex]} ${year}`;
}

export default function ReportsScreen() {
  const { state } = useApp();
  const txs = state.transactions ?? [];
  const accounts = state.accounts ?? [];

  // Derive available year-month periods from transactions
  const periods: PeriodOption[] = useMemo(() => {
    const set = new Set<string>();

    for (const t of txs) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth(); // 0-11
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      set.add(key);
    }

    const arr = Array.from(set).map((key) => {
      const [yStr, mStr] = key.split('-');
      const y = Number(yStr);
      const mIndex = Number(mStr) - 1;
      return {
        key,
        label: formatMonthLabel(y, mIndex),
      };
    });

    // Sort descending (latest month first)
    arr.sort((a, b) => (a.key < b.key ? 1 : -1));
    return arr;
  }, [txs]);

  const [selectedPeriod, setSelectedPeriod] = useState<string | 'all'>('all');

  // Filter transactions by selected period (or show all)
  const filteredTxs = useMemo(() => {
    if (selectedPeriod === 'all') return txs;

    return txs.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return ym === selectedPeriod;
    });
  }, [txs, selectedPeriod]);

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

    for (const t of filteredTxs) {
      const amt = Number(t.amount) || 0;
      const cat = t.category || 'Uncategorised';
      const acc = t.accountId || 'unknown';

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
  }, [filteredTxs]);

  const currentLabel =
    selectedPeriod === 'all'
      ? 'All time'
      : periods.find((p) => p.key === selectedPeriod)?.label ?? 'All time';

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>
        Overview of your spending and income.
      </Text>

      {/* PERIOD FILTER */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          <Pressable
            style={[
              styles.filterChip,
              selectedPeriod === 'all' && styles.filterChipSelected,
            ]}
            onPress={() => setSelectedPeriod('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedPeriod === 'all' && styles.filterChipTextSelected,
              ]}
            >
              All time
            </Text>
          </Pressable>

          {periods.map((p) => (
            <Pressable
              key={p.key}
              style={[
                styles.filterChip,
                selectedPeriod === p.key && styles.filterChipSelected,
              ]}
              onPress={() => setSelectedPeriod(p.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedPeriod === p.key && styles.filterChipTextSelected,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.currentPeriodLabel}>
        Showing: {currentLabel}
      </Text>

      {/* SUMMARY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Summary</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total Income</Text>
          <Text style={[styles.value, styles.income]}>
            £{totalIncome.toFixed(2)}
          </Text>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total Expenses</Text>
          <Text style={[styles.value, styles.expense]}>
            £{totalExpense.toFixed(2)}
          </Text>
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
        {Object.keys(byCategory).length === 0 ? (
          <Text style={styles.emptyText}>
            No transactions in this period.
          </Text>
        ) : (
          Object.entries(byCategory).map(([cat, vals]) => (
            <View style={styles.rowBetween} key={cat}>
              <Text style={styles.label}>{cat}</Text>
              <Text style={styles.value}>
                <Text style={styles.income}>
                  +£{vals.income.toFixed(2)}
                </Text>
                <Text> / </Text>
                <Text style={styles.expense}>
                  -£{vals.expense.toFixed(2)}
                </Text>
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ACCOUNT BREAKDOWN */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>By Account</Text>
        {accounts.length === 0 ? (
          <Text style={styles.emptyText}>
            No accounts yet. Add an account to see account-level reports.
          </Text>
        ) : (
          accounts.map((acc: any) => {
            const vals = byAccount[acc.id] ?? { income: 0, expense: 0 };
            return (
              <View style={styles.rowBetween} key={acc.id}>
                <Text style={styles.label}>{acc.name}</Text>
                <Text style={styles.value}>
                  <Text style={styles.income}>
                    +£{vals.income.toFixed(2)}
                  </Text>
                  <Text> / </Text>
                  <Text style={styles.expense}>
                    -£{vals.expense.toFixed(2)}
                  </Text>
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
    marginBottom: 12,
  },

  filterRow: {
    marginBottom: 6,
    marginTop: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 8,
    backgroundColor: '#020617',
  },
  filterChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  currentPeriodLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 16,
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
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
  },
});
