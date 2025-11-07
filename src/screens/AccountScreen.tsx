// src/screens/AccountScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

const BUDGETS_KEY = 'debitlens_budgets_v1';
type BudgetMap = Record<string, number>;

export default function AccountScreen({ route, navigation }: Props) {
  const { state, actions } = useApp();
  const { accountId } = route.params;

  const accounts = state.accounts || [];
  const allTxs = state.transactions || [];

  const [budgets, setBudgets] = useState<BudgetMap>({});
  const [loadingBudget, setLoadingBudget] = useState(true);

  const account = accounts.find(a => a.id === accountId);

  useEffect(() => {
    let cancelled = false;

    const loadBudgets = async () => {
      try {
        setLoadingBudget(true);
        const json = await SecureStore.getItemAsync(BUDGETS_KEY);
        let map: BudgetMap = {};
        if (json) {
          try {
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === 'object') {
              map = parsed;
            }
          } catch (e) {
            console.warn('[account] parse budgets failed', e);
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
  }, []);

  const txs = useMemo(
    () => allTxs.filter(t => t.accountId === accountId),
    [allTxs, accountId]
  );

  const now = new Date();
  const monthLabel = useMemo(
    () =>
      now.toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  // Current balance for this account
  const balance = useMemo(() => {
    let sum = 0;
    for (const t of txs) {
      if (t.type === 'income') {
        sum += t.amount;
      } else {
        sum -= t.amount;
      }
    }
    return sum;
  }, [txs]);

  // This-month income/expense for this account
  const monthlyTotals = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    let income = 0;
    let expense = 0;
    for (const t of txs) {
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
  }, [txs]);

  // Budget & usage for this account
  const budgetValue = budgets[accountId] ?? 0;

  const spendThisMonth = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    let sum = 0;
    for (const t of txs) {
      if (t.type === 'income') continue;
      const d = new Date(t.date || '');
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() !== y || d.getMonth() !== m) continue;
      sum += t.amount;
    }
    return sum;
  }, [txs]);

  const budgetBadge = useMemo(() => {
    if (!budgetValue || budgetValue <= 0) {
      return {
        show: false,
        text: '',
        bg: '#111827',
        fg: '#E5E7EB',
      };
    }

    const ratio = spendThisMonth / budgetValue;
    const remaining = budgetValue - spendThisMonth;
    const pct = Math.round(ratio * 100);

    if (ratio >= 1) {
      return {
        show: true,
        text: `Over by £${Math.abs(remaining).toFixed(0)} · ${pct}% used`,
        bg: '#7F1D1D',
        fg: '#FEE2E2',
      };
    }

    if (ratio >= 0.8) {
      return {
        show: true,
        text: `£${remaining.toFixed(0)} left · ${pct}% used`,
        bg: '#78350F',
        fg: '#FEF3C7',
      };
    }

    return {
      show: true,
      text: `£${remaining.toFixed(0)} left · ${pct}% used`,
      bg: '#064E3B',
      fg: '#D1FAE5',
    };
  }, [budgetValue, spendThisMonth]);

  const formattedTxs = useMemo(() => {
    return [...txs].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      const cmp = db.localeCompare(da);
      if (cmp !== 0) return cmp;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [txs]);

  const formatDate = (raw: string | undefined) => {
    if (!raw) return 'No date';
    const s = raw.includes('T') ? raw : `${raw}T00:00:00`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString();
  };

  const handleDeleteAccount = () => {
    if (!account) return;

    const hasTx = txs.length > 0;

    const message = hasTx
      ? 'This will delete this account and all its transactions. This cannot be undone.'
      : 'Delete this empty account?';

    Alert.alert('Delete account', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Remove budget entry for this account
            const next = { ...budgets };
            if (next[account.id]) {
              delete next[account.id];
              setBudgets(next);
              await SecureStore.setItemAsync(BUDGETS_KEY, JSON.stringify(next));
            }

            // Remove account + its transactions from app state
            actions.deleteAccount(account.id);

            // Navigate away so we don't stay on a deleted account
            navigation.navigate('Dashboard');
          } catch (e) {
            console.warn('[account] delete failed', e);
            Alert.alert('Error', 'Could not delete this account.');
          }
        },
      },
    ]);
  };

  if (!account) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Account not found</Text>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnPrimary, { marginTop: 16 }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.footerText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>{account.name}</Text>
        <Text style={styles.subtle}>{monthLabel}</Text>

        <Text style={styles.balanceLabel}>Current balance</Text>
        <Text
          style={[
            styles.balanceValue,
            balance >= 0 ? styles.balancePos : styles.balanceNeg,
          ]}
        >
          £{balance.toFixed(2)}
        </Text>

        {/* This month income / expense */}
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

        {/* Budget badge for this account */}
        {!loadingBudget && budgetBadge.show && (
          <View style={[styles.badge, { backgroundColor: budgetBadge.bg }]}>
            <Text style={[styles.badgeText, { color: budgetBadge.fg }]}>
              Budget £{budgetValue.toFixed(0)} · {budgetBadge.text}
            </Text>
          </View>
        )}
        {!loadingBudget && !budgetBadge.show && (
          <Pressable
            style={styles.noBudgetBadge}
            onPress={() => navigation.navigate('Budgets')}
          >
            <Text style={styles.noBudgetText}>
              No budget set · Set in Budgets
            </Text>
          </Pressable>
        )}
      </View>


      {/* TRANSACTIONS LIST */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {formattedTxs.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtle}>
              Add a transaction for this account from the Dashboard.
            </Text>
          </View>
        )}

        {formattedTxs.map(tx => {
          const isIncome = tx.type === 'income';
          const sign = isIncome ? '+' : '−';

          return (
            <View key={tx.id} style={styles.txCard}>
              <View style={styles.txTopRow}>
                <Text style={styles.txType}>
                  {isIncome ? 'Income' : 'Expense'}
                </Text>
                <Text
                  style={[
                    styles.txAmount,
                    isIncome ? styles.txIncome : styles.txExpense,
                  ]}
                >
                  {sign}£{Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>

              <View style={styles.txBottomRow}>
                <Text style={styles.txMeta}>{formatDate(tx.date)}</Text>
                {tx.note ? (
                  <Text
                    style={styles.txNote}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {tx.note}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* FOOTER NAV + DELETE */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.footerText}>Back to Dashboard</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('Budgets')}
        >
          <Text style={styles.footerText}>Adjust Budget</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnDanger]}
          onPress={handleDeleteAccount}
        >
          <Text style={styles.footerText}>Delete</Text>
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
    marginBottom: 8,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 2,
  },
  balanceLabel: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 13,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  balancePos: {
    color: '#4ADE80',
  },
  balanceNeg: {
    color: '#F97373',
  },
  monthLine: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 6,
  },
  monthIncome: {
    color: '#4ADE80',
    fontWeight: '600',
  },
  monthExpense: {
    color: '#F97373',
    fontWeight: '600',
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
  noBudgetBadge: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#0B1120',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  noBudgetText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
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
  txCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txType: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 13,
  },
  txAmount: {
    fontWeight: '800',
    fontSize: 15,
  },
  txIncome: {
    color: '#4ADE80',
  },
  txExpense: {
    color: '#F97373',
  },
  txBottomRow: {
    marginTop: 4,
  },
  txMeta: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  txNote: {
    color: '#E5E7EB',
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#111827',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  footerBtnGhost: {
    backgroundColor: '#0B1120',
  },
  footerBtnDanger: {
    backgroundColor: '#7F1D1D',
  },
  footerText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 13,
  },
});
