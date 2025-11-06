// src/screens/DashboardScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';
import * as SecureStore from 'expo-secure-store';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const BUDGET_KEY = 'debitlens_budget_v1';

export default function DashboardScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [budget, setBudget] = useState<number | null>(null);
  const [loadingBudget, setLoadingBudget] = useState(true);

  // Load monthly budget from SecureStore (same key as Budgets screen)
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(BUDGET_KEY);
        if (stored != null) {
          const num = parseFloat(stored);
          if (Number.isFinite(num) && num > 0) {
            setBudget(num);
          }
        }
      } catch (e) {
        console.warn('[dashboard] load budget failed', e);
      } finally {
        setLoadingBudget(false);
      }
    })();
  }, []);

  // Total balance derived from transactions (income - expenses)
  const totalBalance = useMemo(() => {
    let sum = 0;
    for (const t of txs) {
      if (t.type === 'income') sum += t.amount;
      else sum -= t.amount;
    }
    return sum;
  }, [txs]);

  // This month’s spend for budget comparison
  const { monthLabel, spendThisMonth } = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    let spend = 0;
    for (const t of txs) {
      if (t.type === 'income') continue;
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        spend += t.amount;
      }
    }

    const label = now.toLocaleString(undefined, {
      month: 'short',
      year: 'numeric',
    });

    return { monthLabel: label, spendThisMonth: spend };
  }, [txs]);

  // Budget badge logic
  const budgetBadge = useMemo(() => {
    if (loadingBudget) {
      return {
        show: false,
        text: '',
        bg: '',
        fg: '',
      };
    }
    if (budget == null) {
      return {
        show: false,
        text: '',
        bg: '',
        fg: '',
      };
    }

    const usedRatio = budget > 0 ? spendThisMonth / budget : 0;
    const pct = Math.round(usedRatio * 100);
    const remaining = budget - spendThisMonth;

    let text = '';
    let bg = '#16A34A'; // green
    let fg = '#ECFDF5';

    if (usedRatio >= 1) {
      const over = -remaining;
      text = `Over budget by £${over.toFixed(0)} (${pct}%)`;
      bg = '#B91C1C'; // red
      fg = '#FEE2E2';
    } else if (usedRatio >= 0.8) {
      text = `Close to limit (${pct}% used)`;
      bg = '#D97706'; // amber
      fg = '#FFFBEB';
    } else {
      text = `On track · £${remaining.toFixed(0)} left`;
      bg = '#15803D';
      fg = '#ECFDF5';
    }

    return { show: true, text, bg, fg };
  }, [budget, spendThisMonth, loadingBudget]);

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Total balance</Text>
          <Text style={styles.total}>
            £{totalBalance.toFixed(2)}
          </Text>

          {/* Budget badge */}
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

          {!loadingBudget && budget == null && (
            <Pressable
              onPress={() => navigation.navigate('Budgets')}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                Set a monthly budget →
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ACCOUNTS LIST */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
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
          // Simple per-account balance derived from txs
          const accTxs = txs.filter((t) => t.accountId === a.id);
          const bal = accTxs.reduce((sum, t) => {
            if (t.type === 'income') return sum + t.amount;
            return sum - t.amount;
          }, 0);

          const lastTx = accTxs
            .slice()
            .sort((x, y) =>
              (y.date || '').localeCompare(x.date || '')
            )[0];

          const lastDate = lastTx?.date
            ? new Date(lastTx.date + 'T00:00:00')
            : null;

          return (
            <Pressable
              key={String(a.id)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() =>
                navigation.navigate('Account', {
                  accountId: a.id,
                })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{a.name}</Text>
                <Text
                  style={[
                    styles.cardBalance,
                    { color: bal < 0 ? '#F97373' : '#4ADE80' },
                  ]}
                >
                  £{bal.toFixed(2)}
                </Text>
              </View>

              {lastTx ? (
                <Text style={styles.cardSubtle}>
                  {lastTx.note || lastTx.type || 'Transaction'}{' '}
                  {lastDate
                    ? `· ${lastDate.toLocaleDateString()}`
                    : ''}
                </Text>
              ) : (
                <Text style={styles.cardSubtle}>
                  No transactions yet
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* QUICK ACTIONS */}
      <View style={styles.quickBar}>
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

  quickBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#111827',
    marginTop: 4,
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
});
