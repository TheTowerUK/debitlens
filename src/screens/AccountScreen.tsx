// src/screens/AccountScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ navigation, route }: Props) {
  const { state } = useApp();

  const accountId = route.params?.accountId;
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  // ✅ This is the line you referenced
  const account =
    accounts.find((a: any) => a.id === accountId) || accounts[0];

  const accountTxs = useMemo(
    () => (account ? txs.filter((t) => t.accountId === account.id) : []),
    [txs, account]
  );

  // Summary numbers (unchanged logic from your snippet)
  const { netFromTxs, income, expense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of accountTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }
    return {
      netFromTxs: income - expense,
      income,
      expense,
    };
  }, [accountTxs]);

  /**
   * Backwards running balance (safe for imported historic dates)
   * Assumption: account.balance is the CURRENT balance now.
   * We show "Bal £X" as the balance AFTER that transaction (at that point in time),
   * in a newest-first list.
   */
  const sortedAccountTxs = useMemo(() => {
    const copy = [...accountTxs];
    copy.sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      // Newest first
      const d = db.localeCompare(da);
      if (d !== 0) return d;
      // tie-breaker
      return String(b.id).localeCompare(String(a.id));
    });
    return copy;
  }, [accountTxs]);

  const currentBalanceNow = useMemo(() => {
    const b = Number((account as any)?.balance);
    // If account.balance is missing/not numeric, fall back to netFromTxs
    return Number.isFinite(b) ? b : netFromTxs;
  }, [account, netFromTxs]);

  const balanceAfterMap = useMemo(() => {
    let running = currentBalanceNow;
    const map: Record<string, number> = {};

    for (const t of sortedAccountTxs) {
      // Balance AFTER this txn (in time) = running at this point
      map[t.id] = running;

      const amt = Number(t.amount) || 0;
      const delta =
        t.type === 'income' ? +amt : t.type === 'expense' ? -amt : 0;

      // Move backwards in time: remove this txn’s effect
      running = running - delta;
    }

    return map;
  }, [sortedAccountTxs, currentBalanceNow]);

  const handleQuickAdd = (type: 'income' | 'expense') => {
    if (!account) return;
    navigation.navigate('TxnEditor', {
      accountId: account.id,
      type,
    });
  };

  const handleTransfer = () => {
    if (!account) return;
    navigation.navigate('Transfer', { fromAccountId: account.id });
  };

  const handleEditTxn = (id: string) => {
    navigation.navigate('TxnEditor', { id });
  };

  if (!account) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Account</Text>
        <Text style={styles.subtle}>
          No accounts found. Add one from the Dashboard.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{account.name || 'Account'}</Text>
      <Text style={styles.subtle}>Overview for this account.</Text>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={styles.summaryValue}>
            £{Number(currentBalanceNow).toFixed(2)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income / Spending</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            +£{income.toFixed(2)}
          </Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            -£{expense.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Quick add */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickButton, styles.quickIncome]}
          onPress={() => handleQuickAdd('income')}
        >
          <Text style={styles.quickText}>Add income</Text>
        </Pressable>

        <Pressable
          style={[styles.quickButton, styles.quickExpense]}
          onPress={() => handleQuickAdd('expense')}
        >
          <Text style={styles.quickText}>Add expense</Text>
        </Pressable>
      </View>

      {/* Transfer */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickButton, styles.quickTransfer]}
          onPress={handleTransfer}
        >
          <Text style={styles.quickText}>Transfer</Text>
        </Pressable>
      </View>

      <View style={styles.sectionDivider} />

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>

      {sortedAccountTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Add income or expenses to see them listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedAccountTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            const sign = isIncome ? '+' : '-';
            const label = item.category || 'Uncategorised';
            const note = item.description || '';

            return (
              <Pressable
                style={styles.txRow}
                onPress={() => handleEditTxn(item.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  {note ? <Text style={styles.txNote}>{note}</Text> : null}
                  {item.date ? (
                    <Text style={styles.txMeta}>{item.date}</Text>
                  ) : null}
                </View>

                {/* Amount + Balance-after */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.txAmount,
                      isIncome ? styles.incomeText : styles.expenseText,
                    ]}
                  >
                    {sign}£{Number(item.amount).toFixed(2)}
                  </Text>

                  <Text style={styles.txBalanceAfter}>
                    Bal £{Number(balanceAfterMap[item.id] ?? 0).toFixed(2)}
                  </Text>
                </View>
              </Pressable>
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
    padding: 16,
  },
  h1: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtle: {
    opacity: 0.8,
    marginBottom: 14,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.95,
  },
  summaryLabel: {
    opacity: 0.8,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },

  incomeText: {},
  expenseText: {},

  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  quickButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickIncome: {},
  quickExpense: {},
  quickTransfer: {
    flex: 1,
  },
  quickText: {
    fontWeight: '700',
  },

  sectionDivider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },

  emptyBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.95,
  },
  emptyTitle: {
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    opacity: 0.85,
  },

  txRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    opacity: 0.98,
  },
  txLabel: {
    fontWeight: '800',
    marginBottom: 2,
  },
  txNote: {
    opacity: 0.85,
    marginBottom: 2,
  },
  txMeta: {
    opacity: 0.7,
    fontSize: 12,
  },
  txAmount: {
    fontWeight: '800',
    fontSize: 16,
  },
  txBalanceAfter: {
    marginTop: 4,
    opacity: 0.75,
    fontSize: 12,
  },
});
