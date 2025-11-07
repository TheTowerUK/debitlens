// src/screens/DashboardScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';
import * as SecureStore from 'expo-secure-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const BUDGETS_KEY = 'debitlens_budgets_v1';
const LEGACY_BUDGET_KEY = 'debitlens_budget_v1';

type BudgetMap = Record<string, number>;

export default function DashboardScreen({ navigation }: Props) {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const allTxs = state.transactions || [];

  const [budgets, setBudgets] = useState<BudgetMap>({});
  const [loadingBudget, setLoadingBudget] = useState(true);

  // 💹 Overall month income/expense across ALL accounts
  const monthlyTotals = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();

    let income = 0;
    let expense = 0;

    for (const t of allTxs) {
      const d = new Date(t.date || '');
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() !== y || d.getMonth() !== m) continue;

      if (t.type === 'income') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    }

    return { income, expense };
  }, [allTxs]);


  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // 🔁 Reload budgets whenever the Dashboard gains focus
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;

      const loadBudgets = async () => {
        try {
          setLoadingBudget(true);
          let map: BudgetMap = {};

          const json = await SecureStore.getItemAsync(BUDGETS_KEY);
          if (json) {
            try {
              const parsed = JSON.parse(json);
              if (parsed && typeof parsed === 'object') {
                map = parsed;
              }
            } catch (e) {
              console.warn('[dashboard] parse budgets failed', e);
            }
          } else {
            // Legacy: single budget => map to first account if any
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
            setLoadingBudget(false);
          }
        }
      };

      loadBudgets();
      return () => {
        cancelled = true;
      };
    }, [accounts.length])
  );

  // 💰 Total balance from selector
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const accTxs = allTxs.filter(t => t.accountId === a.id);
      const bal = accTxs.reduce((sub, t) => {
        return sub + (t.type === 'income' ? t.amount : -t.amount);
      }, 0);
      return sum + bal;
    }, 0);
  }, [accounts, allTxs]);


  // 👉 Which account should the pill show? (first one that has a budget)
  const budgetAccountId = useMemo(() => {
    if (!accounts.length) return null;
    const withBudget = accounts.find(a => budgets[a.id] != null);
    return withBudget?.id ?? null;
  }, [accounts, budgets]);

  const currentBudget =
    budgetAccountId && budgets[budgetAccountId] != null
      ? budgets[budgetAccountId]
      : null;

  const currentBudgetAccount =
    budgetAccountId && accounts.find(a => a.id === budgetAccountId)
      ? (accounts.find(a => a.id === budgetAccountId) as (typeof accounts)[number])
      : null;

  // 🔁 Get all transactions for the budget account DIRECTLY from state.transactions
  const budgetAccountTxs = useMemo(
    () =>
      budgetAccountId
        ? allTxs.filter(t => t.accountId === budgetAccountId)
        : [],
    [budgetAccountId, allTxs]
  );

  // 📆 Compute this month's spend for that one account
  const { monthLabel, spendThisMonth } = useMemo(() => {
    if (!budgetAccountId) {
      return { monthLabel: '', spendThisMonth: 0 };
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    let spend = 0;
    for (const t of budgetAccountTxs) {
      if (t.type === 'income') continue;
      const d = new Date(t.date || '');
      if (
        !isNaN(d.getTime()) &&
        d.getFullYear() === year &&
        d.getMonth() === month
      ) {
        spend += t.amount;
      }
    }

    const label = now.toLocaleString(undefined, {
      month: 'short',
      year: 'numeric',
    });

    return { monthLabel: label, spendThisMonth: spend };
  }, [budgetAccountId, budgetAccountTxs]);

  // 🎯 Build pill text + colours
  const budgetBadge = useMemo(() => {
    if (loadingBudget || !currentBudget || !currentBudgetAccount) {
      return { show: false, text: '', bg: '', fg: '' };
    }

    const usedRatio = currentBudget > 0 ? spendThisMonth / currentBudget : 0;
    const pct = Math.round(usedRatio * 100);
    const remaining = currentBudget - spendThisMonth;

    let text = '';
    let bg = '#16A34A';
    let fg = '#ECFDF5';

    if (usedRatio >= 1) {
      const over = -remaining;
      text = `${currentBudgetAccount.name} · over by £${over.toFixed(0)} (${pct}%)`;
      bg = '#B91C1C';
      fg = '#FEE2E2';
    } else if (usedRatio >= 0.8) {
      text = `${currentBudgetAccount.name} · ${pct}% of budget used`;
      bg = '#D97706';
      fg = '#FFFBEB';
    } else {
      text = `${currentBudgetAccount.name} · £${remaining.toFixed(
        0
      )} left (${pct}% used)`;
      bg = '#15803D';
      fg = '#ECFDF5';
    }

    return { show: true, text, bg, fg };
  }, [loadingBudget, currentBudget, currentBudgetAccount, spendThisMonth]);

  // ➕ Add account handler
  const handleAddAccount = () => {
    const name = newName.trim();
    if (!name) return;
    actions.addAccount(name);
    setNewName('');
    setAdding(false);
  };

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Total balance</Text>
          <Text style={styles.total}>£{totalBalance.toFixed(2)}</Text>

          {/* This month income / expense (all accounts) */}
          <Text style={styles.monthLine}>
            This month:{' '}
            <Text style={styles.monthIncome}>
              +£{monthlyTotals.income.toFixed(2)}
            </Text>{' '}
            ·{' '}
            <Text style={styles.monthExpense}>
              -£{monthlyTotals.expense.toFixed(2)}
            </Text>
          </Text>

          {/* Budget pill */}
          {budgetBadge.show && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: budgetBadge.bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: budgetBadge.fg },
                ]}
              >
                {monthLabel} · {budgetBadge.text}
              </Text>
            </View>
          )}

          {/* No budget yet → nudge */}
          {!loadingBudget && !currentBudget && (
            <Pressable
              onPress={() => navigation.navigate('Budgets')}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>Set a monthly budget →</Text>
            </Pressable>
          )}

          {/* DEBUG: what Dashboard thinks is happening */}
          {budgetAccountId && (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: '#6B7280', fontSize: 11 }}>
                Debug · accountId: {String(budgetAccountId)}
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 11 }}>
                Debug · budget: £{(currentBudget ?? 0).toFixed(2)} · spendThisMonth: £
                {spendThisMonth.toFixed(2)} · txCount: {budgetAccountTxs.length}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ACCOUNTS LIST */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {accounts.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySubtle}>
              Add an account to start tracking balances and transactions.
            </Text>
          </View>
        )}

        {accounts.map((a) => {
          // All transactions for this account
          const accTxs = allTxs.filter(t => t.accountId === a.id);

          // Balance for this account
          const bal = accTxs.reduce((sum, t) => {
            return sum + (t.type === 'income' ? t.amount : -t.amount);
          }, 0);

          // Most recent transaction (assuming newest by date)
          const sorted = [...accTxs].sort((x, y) =>
            (y.date || '').localeCompare(x.date || '')
          );
          const lastTx = sorted[0] || null;
          const lastDate = lastTx?.date ? new Date(`${lastTx.date}T00:00:00`) : null;

          // …rest of your JSX unchanged…
          return (
            <Pressable
              key={String(a.id)}
              /* your existing styles and onPress here */
            >
              {/* use `bal`, `lastTx`, `lastDate` exactly like before */}
            </Pressable>
          );
        })}


        {/* ADD ACCOUNT PANEL */}
        {adding && (
          <View style={styles.addCard}>
            <Text style={styles.addLabel}>New account name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Holiday Fund"
              placeholderTextColor="#6B7280"
              style={styles.addInput}
            />
            <View style={styles.addRow}>
              <Pressable
                style={[styles.addBtn, styles.addBtnCancel]}
                onPress={() => {
                  setAdding(false);
                  setNewName('');
                }}
              >
                <Text style={styles.addBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.addBtn, styles.addBtnSave]}
                onPress={handleAddAccount}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM QUICK MENU */}
      <View style={styles.quickBar}>
        <Pressable
          style={styles.quickBtnPrimary}
          onPress={() => setAdding(true)}
        >
          <Text style={styles.quickLabelPrimary}>+ Add account</Text>
        </Pressable>

        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('TxnEditor')}
        >
          <Text style={styles.quickLabel}>+ Transaction</Text>
        </Pressable>

        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.quickLabel}>History</Text>
        </Pressable>

        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Budgets')}
        >
          <Text style={styles.quickLabel}>Budgets</Text>
        </Pressable>

        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Reports')}
        >
          <Text style={styles.quickLabel}>Reports</Text>
        </Pressable>

        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.quickLabel}>Settings</Text>
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
  header: {
    marginBottom: 12,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  total: {
    color: '#F9FAFB',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  badge: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  linkRow: {
    marginTop: 6,
  },
  linkText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },

  scroll: {
    flex: 1,
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
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 16,
  },
  cardBalance: {
    fontWeight: '800',
    fontSize: 16,
  },
  cardSubtle: {
    color: '#9CA3AF',
    marginTop: 6,
    fontSize: 12,
  },

  addCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  addLabel: {
    color: '#9CA3AF',
    marginBottom: 6,
  },
  addInput: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginLeft: 8,
  },
  addBtnCancel: {
    backgroundColor: '#1F2937',
  },
  addBtnSave: {
    backgroundColor: '#2563EB',
  },
  addBtnText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 13,
  },

  quickBar: {
    borderTopWidth: 1,
    borderColor: '#111827',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickBtnPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  quickLabelPrimary: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 13,
  },
  quickBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#0B1120',
  },
  quickLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
    monthLine: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  monthIncome: {
    color: '#4ADE80',
    fontWeight: '600',
  },
  monthExpense: {
    color: '#F97373',
    fontWeight: '600',
  },

});
