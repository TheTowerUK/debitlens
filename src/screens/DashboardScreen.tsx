// src/screens/DashboardScreen.tsx
import React, { useMemo } from 'react';
import {  View,  Text,  StyleSheet,  FlatList,  Pressable,  Platform,  Alert,} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  
  
  
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const { totalBalance, totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return { totalBalance: income - expense, totalIncome: income, totalExpense: expense };
  }, [txs]);

  const recentTxs = useMemo(() => {
    const copy = [...txs];
    copy.sort(
      (x, y) =>
        (y.date ? Date.parse(y.date) : 0) -
        (x.date ? Date.parse(x.date) : 0)
    );
    return copy.slice(0, 10);
  }, [txs]);

  const handleQuickAdd = (type: 'income' | 'expense') => {
    navigation.navigate('TxnEditor', { type });
  };

  // Safe handler for AddAccount (no warning if route not registered)
  const goAddAccount = () => {
    const routeNames = (navigation.getState?.() as any)?.routeNames as string[] | undefined;
    if (routeNames?.includes('AddAccount')) {
      navigation.navigate('AddAccount');
    } else {
      Alert.alert(
        'Add account unavailable',
        'This build does not include an Add Account screen yet.'
      );
    }
  };

  const go = (route: keyof RootStackParamList, params?: any) => {
    const current = (navigation.getState?.() as any)?.routeNames as string[] | undefined;
    if (current?.includes(route as string)) {
      // @ts-ignore
      navigation.navigate(route, params);
      return;
    }
    const parentNav: any = navigation.getParent?.();
    const parentRoutes = parentNav?.getState?.()?.routeNames as string[] | undefined;
    if (parentNav && parentRoutes?.includes(route as string)) {
      parentNav.navigate(route as never, params as never);
      return;
    }
    Alert.alert('Screen unavailable', `No "${route}" screen in the current navigator.`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Debit Lens</Text>
      <Text style={styles.subtle}>Snapshot of your accounts and recent activity.</Text>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Net balance</Text>
          <Text style={styles.summaryValue}>£{totalBalance.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income / Spending</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            +£{totalIncome.toFixed(2)}
          </Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            -£{totalExpense.toFixed(2)}
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

      {/* Navigation pills */}

      <View style={styles.quickRow}>
        <Pressable style={styles.secondaryButton} onPress={() => go('Payments')}>
          <Text style={styles.secondaryText}>Payments</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton} onPress={() => go('Budgets')} >
          <Text style={styles.secondaryText}>Budgets</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton} onPress={() => go('Reports')}        >
          <Text style={styles.secondaryText}>Reports</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => go('Recurring')}>
          <Text style={styles.secondaryText}>Recurring</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => go('Notifications')}>
          <Text style={styles.secondaryText}>Notifications</Text>
        </Pressable>

      </View>

      <View style={styles.quickRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Settings')}        >
          <Text style={styles.secondaryText}>Settings</Text>
        </Pressable>
      </View>

      {/* Add account (wide) */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.secondaryButton, styles.addAccountButton]}
          onPress={goAddAccount}
        >
          <Text style={[styles.secondaryText, styles.addAccountText]}>
            Add account
          </Text>
        </Pressable>
      </View>
      <View style={styles.sectionDivider} />

      {/* Accounts */}
      <Text style={styles.sectionTitle}>Accounts</Text>
      {accounts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No accounts yet</Text>
          <Text style={styles.emptyText}>
            Once you add accounts, they&apos;ll appear here with their balances.
          </Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => {
            const accTxs = txs.filter((t) => t.accountId === item.id);
            const bal = accTxs.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
            return (
              <Pressable
                style={styles.accountCard}
                onPress={() => navigation.navigate('Account', { accountId: item.id })}
              >
                <Text style={styles.accountName}>{item.name}</Text>
                <Text style={styles.accountBalance}>£{Number(bal).toFixed(2)}</Text>
                <Text style={styles.accountMeta}>
                  {accTxs.length} transaction{accTxs.length === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Recent transactions */}
      <Text style={styles.sectionTitle}>Recent activity</Text>
      {recentTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Add income or expenses to see them listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recentTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            const sign = isIncome ? '+' : '-';
            const label = item.category || 'Uncategorised';
            const note = item.note || '';
            return (
              <View style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  {note ? <Text style={styles.txNote}>{note}</Text> : null}
                  {item.date ? <Text style={styles.txMeta}>{item.date}</Text> : null}
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    isIncome ? styles.incomeText : styles.expenseText,
                  ]}
                >
                  {sign}£{Number(item.amount).toFixed(2)}
                </Text>
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

  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 8,
    marginTop: 4,
  },
  secondaryText: { color: '#E5E7EB', fontSize: 12, fontWeight: '600' },

  // Add account pill tweaks + divider
  addAccountButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignSelf: 'stretch',
    backgroundColor: '#0F172A',
    borderColor: '#243041',
  },
  addAccountText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  sectionDivider: { height: 1, backgroundColor: '#111827', marginTop: 10, marginBottom: 12 },

  sectionTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 6 },

  emptyBox: {
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  emptyTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyText: { color: '#9CA3AF', fontSize: 14 },

  accountCard: {
    width: 180,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 10,
  },
  accountName: { color: '#F9FAFB', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  accountBalance: { color: '#E5E7EB', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  accountMeta: { color: '#9CA3AF', fontSize: 12 },

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
