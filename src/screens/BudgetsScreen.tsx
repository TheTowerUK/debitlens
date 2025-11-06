// src/screens/BudgetsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;

const BUDGETS_KEY = 'debitlens_budgets_v1';
const LEGACY_BUDGET_KEY = 'debitlens_budget_v1';

type BudgetMap = Record<string, number>;
type EditingMap = Record<string, string>;

export default function BudgetsScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [budgets, setBudgets] = useState<BudgetMap>({});
  const [editing, setEditing] = useState<EditingMap>({});
  const [loading, setLoading] = useState(true);

  // Load budgets whenever Budgets screen is focused
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      const load = async () => {
        try {
          setLoading(true);
          let map: BudgetMap = {};

          const json = await SecureStore.getItemAsync(BUDGETS_KEY);
          if (json) {
            try {
              const parsed = JSON.parse(json);
              if (parsed && typeof parsed === 'object') {
                map = parsed;
              }
            } catch (e) {
              console.warn('[budgets] parse budgets failed', e);
            }
          } else {
            // Legacy single budget -> map to first account
            const legacy = await SecureStore.getItemAsync(LEGACY_BUDGET_KEY);
            if (legacy && accounts.length > 0) {
              const n = parseFloat(legacy);
              if (Number.isFinite(n) && n > 0) {
                map[accounts[0].id] = n;
              }
            }
          }

          if (!cancelled) {
            setBudgets(map);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [accounts.length])
  );

  // Keep text inputs in sync when budgets change
  useEffect(() => {
    const next: EditingMap = {};
    for (const acc of accounts) {
      const v = budgets[acc.id];
      next[acc.id] = v != null && !isNaN(v) ? String(v) : '';
    }
    setEditing(next);
  }, [budgets, accounts]);

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // Helper: compute this month's spend for a single account
  const monthSpendForAccount = (accountId: string): number => {
    let sum = 0;
    for (const t of txs) {
      if (t.accountId !== accountId) continue;
      if (t.type === 'income') continue;
      const d = new Date(t.date || '');
      if (
        !isNaN(d.getTime()) &&
        d.getFullYear() === thisYear &&
        d.getMonth() === thisMonth
      ) {
        sum += t.amount;
      }
    }
    return sum;
  };

  // Overall totals (optional, just for summary)
  const summary = useMemo(() => {
    let totalBudget = 0;
    let totalSpend = 0;

    for (const acc of accounts) {
      const b = budgets[acc.id] ?? 0;
      const s = monthSpendForAccount(acc.id);
      if (b > 0) totalBudget += b;
      totalSpend += s;
    }

    return { totalBudget, totalSpend };
  }, [accounts, budgets, txs]);

  const monthLabel = useMemo(
    () =>
      now.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [thisMonth, thisYear]
  );

  const saveBudget = async (accountId: string) => {
    const raw = editing[accountId]?.trim() ?? '';
    if (!raw) {
      // Clear budget
      const next = { ...budgets };
      delete next[accountId];
      setBudgets(next);
      await SecureStore.setItemAsync(BUDGETS_KEY, JSON.stringify(next));
      return;
    }

    const n = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number for the budget.');
      return;
    }

    const next = { ...budgets, [accountId]: n };
    setBudgets(next);
    await SecureStore.setItemAsync(BUDGETS_KEY, JSON.stringify(next));
  };

  const clearAllBudgets = async () => {
    Alert.alert(
      'Clear all budgets?',
      'This will remove monthly budgets from all accounts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setBudgets({});
            setEditing({});
            await SecureStore.setItemAsync(BUDGETS_KEY, JSON.stringify({}));
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Budgets</Text>
      <Text style={styles.subtle}>
        Monthly budgets per account · {monthLabel}
      </Text>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLine}>
          Total budget:{' '}
          <Text style={styles.summaryValue}>
            £{summary.totalBudget.toFixed(2)}
          </Text>
        </Text>
        <Text style={styles.summaryLine}>
          This month spend:{' '}
          <Text style={styles.summaryValue}>
            £{summary.totalSpend.toFixed(2)}
          </Text>
        </Text>
        {summary.totalBudget > 0 && (
          <Text style={styles.summaryLine}>
            Used:{' '}
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    summary.totalSpend / summary.totalBudget >= 1
                      ? '#F97373'
                      : '#4ADE80',
                },
              ]}
            >
              {Math.round(
                (summary.totalSpend / summary.totalBudget) * 100
              ) || 0}
              %
            </Text>
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {accounts.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySubtle}>
              Add an account on the Dashboard to start setting budgets.
            </Text>
          </View>
        )}

        {accounts.map(acc => {
          const budget = budgets[acc.id] ?? 0;
          const spend = monthSpendForAccount(acc.id);
          const ratio = budget > 0 ? spend / budget : 0;
          const pct = Math.round(ratio * 100);

          let statusText = 'No budget set';
          let statusColor = '#9CA3AF';

          if (budget > 0) {
            const remaining = budget - spend;
            if (ratio >= 1) {
              statusText = `Over by £${(-remaining).toFixed(0)} (${pct}% used)`;
              statusColor = '#F97373';
            } else if (ratio >= 0.8) {
              statusText = `£${remaining.toFixed(0)} left (${pct}% used)`;
              statusColor = '#FBBF24';
            } else {
              statusText = `£${remaining.toFixed(0)} left (${pct}% used)`;
              statusColor = '#4ADE80';
            }
          }

          return (
            <View key={acc.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardName}>{acc.name}</Text>
                  <Text style={[styles.cardStatus, { color: statusColor }]}>
                    {statusText}
                  </Text>
                </View>
                {budget > 0 && (
                  <Text style={styles.cardBudgetValue}>
                    £{budget.toFixed(0)}
                  </Text>
                )}
              </View>

              <Text style={styles.cardDetail}>
                This month spend: £{spend.toFixed(2)}
              </Text>

              <View style={styles.row}>
                <TextInput
                  value={editing[acc.id] ?? ''}
                  onChangeText={txt =>
                    setEditing(prev => ({ ...prev, [acc.id]: txt }))
                  }
                  placeholder="Monthly budget (£)"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <Pressable
                  style={styles.saveBtn}
                  onPress={() => saveBudget(acc.id)}
                >
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={clearAllBudgets}>
          <Text style={styles.footerText}>Clear all budgets</Text>
        </Pressable>

        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.footerText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 12,
  },
  summaryLine: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  summaryValue: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 16,
  },
  cardStatus: {
    marginTop: 4,
    fontSize: 13,
  },
  cardBudgetValue: {
    color: '#E5E7EB',
    fontWeight: '800',
    fontSize: 16,
  },
  cardDetail: {
    color: '#9CA3AF',
    marginTop: 6,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    marginTop: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
    fontSize: 13,
  },
  saveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  saveText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 13,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#111827',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
  },
  footerBtnGhost: {
    backgroundColor: '#0B1120',
  },
  footerText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 13,
  },
});
