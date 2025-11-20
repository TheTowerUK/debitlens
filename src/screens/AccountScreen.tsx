// src/screens/AccountScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ navigation, route }: Props) {
  const { state } = useApp();

  const accountId = route.params?.accountId;
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const account = accounts.find((a: any) => a.id === accountId) || accounts[0];

  const accountTxs = useMemo(
    () => (account ? txs.filter((t) => t.accountId === account.id) : []),
    [txs, account]
  );

  const { balance, income, expense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of accountTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return {
      balance: income - expense,
      income,
      expense,
    };
  }, [accountTxs]);

  const handleQuickAdd = (type: 'income' | 'expense') => {
    if (!account) return;
    navigation.navigate('TxnEditor', {
      accountId: account.id,
      type,
    });
  };

  const handleEditTxn = (id: string) => {
    navigation.navigate('TxnEditor', { id });
  };

  if (!account) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Account</Text>
        <Text style={styles.subtle}>No accounts found. Add one from the Dashboard.</Text>
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
          <Text style={styles.summaryValue}>£{balance.toFixed(2)}</Text>
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

      <View style={styles.sectionDivider} />

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>
      {accountTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Add income or expenses to see them listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={accountTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            const sign = isIncome ? '+' : '-';
            const label = item.category || 'Uncategorised';
            const note = item.note || '';
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
                <Text
                  style={[
                    styles.txAmount,
                    isIncome ? styles.incomeText : styles.expenseText,
                  ]}
                >
                  {sign}£{Number(item.amount).toFixed(2)}
                </Text>
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
  subtle: { color: '#9CA3AF', marginBottom: 16 },

  summaryRow: { flexDirection: 'row', marginBottom: 12 },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 8,
  },
  summaryLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
  summaryValue: { color: '#F9FAFB', fontSize: 16, fontWeight: '800' },

  incomeText: { color: '#22C55E' },
  expenseText: { color: '#F97373' },

  quickRow: { flexDirection: 'row', marginBottom: 12, flexWrap: 'wrap' },
  quickButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginRight: 8,
  },
  quickIncome: { backgroundColor: 'rgba(22, 163, 74, 0.2)' },
  quickExpense: { backgroundColor: 'rgba(220, 38, 38, 0.2)' },
  quickText: { color: '#F9FAFB', fontWeight: '700', fontSize: 13 },

  sectionDivider: {
    height: 1,
    backgroundColor: '#111827',
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },

  emptyBox: {
    marginTop: 8,
    marginBottom: 16,
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
  emptyText: { color: '#9CA3AF', fontSize: 14 },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  txLabel: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
  txNote: { color: '#9CA3AF', fontSize: 12 },
  txMeta: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800', marginLeft: 12 },
});
