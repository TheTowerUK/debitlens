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

  // ✅ Where the find(...) lives
  const account =
    accounts.find((a: any) => a.id === accountId) || accounts[0];

  const accountTxs = useMemo(
    () => (account ? txs.filter((t) => t.accountId === account.id) : []),
    [txs, account]
  );

  // Income/expense totals (for summary)
  const { income, expense, netFromTxs } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of accountTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }
    return { income, expense, netFromTxs: income - expense };
  }, [accountTxs]);

  // Treat account.balance as the CURRENT balance "now" (after all txns)
  const currentBalanceNow = useMemo(() => {
    const b = Number((account as any)?.balance);
    // fallback: if missing, show net (still works, but less meaningful)
    return Number.isFinite(b) ? b : netFromTxs;
  }, [account, netFromTxs]);

  /**
   * ✅ Correct running balance:
   * 1) Sort txns oldest -> newest
   * 2) Compute net effect of all txns
   * 3) openingBalance = currentBalanceNow - net
   * 4) Run forward; map[txn.id] = balance AFTER txn
   */
  const balanceAfterMap = useMemo(() => {
    if (!account) return {};

    const asc = [...accountTxs].sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      const d = da.localeCompare(db);
      if (d !== 0) return d;
      return String(a.id).localeCompare(String(b.id));
    });

    let net = 0;
    for (const t of asc) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') net += amt;
      else if (t.type === 'expense') net -= amt;
      // transfers: ignored here unless you model them as +/- per account
    }

    let running = Number(currentBalanceNow) - net;

    const map: Record<string, number> = {};
    for (const t of asc) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') running += amt;
      else if (t.type === 'expense') running -= amt;

      map[t.id] = running; // balance AFTER this txn
    }

    return map;
  }, [account, accountTxs, currentBalanceNow]);

  // Display newest-first (common UX), but balances remain correct
  const displayTxs = useMemo(() => {
    const copy = [...accountTxs];
    copy.sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      const d = db.localeCompare(da); // newest first
      if (d !== 0) return d;
      return String(b.id).localeCompare(String(a.id));
    });
    return copy;
  }, [accountTxs]);

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
          <Text style={styles.summaryLabel}>Current balance</Text>
          <Text style={styles.summaryValue}>£{currentBalanceNow.toFixed(2)}</Text>
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

      {displayTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Add income or expenses to see them listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            const sign = isIncome ? '+' : '-';
            const label = item.category || 'Uncategorised';
            const note = item.description || '';
            const balAfter = balanceAfterMap[item.id];

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
                    Bal £{Number(balAfter ?? currentBalanceNow).toFixed(2)}
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
    backgroundColor: '#000', // ✅ black background
  },
  h1: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
    color: '#fff',
  },
  subtle: {
    opacity: 0.8,
    marginBottom: 14,
    color: '#fff',
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
    borderColor: '#222',
    backgroundColor: '#0b0b0b',
  },
  summaryLabel: {
    opacity: 0.8,
    marginBottom: 6,
    color: '#fff',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },

  incomeText: {
    color: '#3ddc84',
  },
  expenseText: {
    color: '#ff6b6b',
  },

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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#0b0b0b',
  },
  quickIncome: {},
  quickExpense: {},
  quickTransfer: {
    flex: 1,
  },
  quickText: {
    fontWeight: '700',
    color: '#fff',
  },

  sectionDivider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 12,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    color: '#fff',
  },

  emptyBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#0b0b0b',
  },
  emptyTitle: {
    fontWeight: '800',
    marginBottom: 6,
    color: '#fff',
  },
  emptyText: {
    opacity: 0.85,
    color: '#fff',
  },

  txRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  txLabel: {
    fontWeight: '800',
    marginBottom: 2,
    color: '#fff',
  },
  txNote: {
    opacity: 0.85,
    marginBottom: 2,
    color: '#fff',
  },
  txMeta: {
    opacity: 0.7,
    fontSize: 12,
    color: '#fff',
  },
  txAmount: {
    fontWeight: '800',
    fontSize: 16,
  },
  txBalanceAfter: {
    marginTop: 4,
    opacity: 0.75,
    fontSize: 12,
    color: '#fff',
  },
});
