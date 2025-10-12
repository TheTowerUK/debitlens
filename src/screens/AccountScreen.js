// src/screens/AccountScreen.js
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

export default function AccountScreen({ route, navigation }) {
  const { state, actions, selectors } = useApp();
  const prefs = state?.prefs || {};
  const accountId = String(route.params?.accountId ?? '');

  // Lookup account
  const account = useMemo(
    () => (state?.accounts ?? []).find(a => String(a.id) === accountId) || null,
    [state?.accounts, accountId]
  );

  // Account balance from selector
  const balance = useMemo(
    () => (account ? selectors.accountBalance(account.id) : 0),
    [selectors, account]
  );

  // Transactions for this account (sorted newest first)
  const accountTxns = useMemo(() => {
    const all = state?.transactions ?? [];
    return all
      .filter(t => String(t.accountId) === accountId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [state?.transactions, accountId]);

  const onDelete = (id) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteTransaction(id) },
    ]);
  };

  if (!account) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>Account not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>{account.name}</Text>
          <Text style={[styles.balance, balance < 0 ? styles.red : styles.green]}>
            {money(balance, prefs)}
          </Text>
        </View>
      </View>

      {/* Transactions */}
      <FlatList
        data={accountTxns}
        keyExtractor={(item, index) =>
          String(item.id ?? `${item.accountId}-${item.date}-${index}`)
        }
        contentContainerStyle={{ paddingBottom: 96 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={[styles.subtle, { padding: 16 }]}>
            No transactions yet. Tap + to add one.
          </Text>
        }
        renderItem={({ item }) => {
          const isExpense = item.type === 'expense';
          const sign = isExpense ? '-' : '+';
          return (
            <Pressable
              style={styles.rowItem}
              onPress={() => navigation.navigate('TxnEditor', { mode: 'edit', txnId: item.id })}
              onLongPress={() => onDelete(item.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTop}>
                  {(item.category || '—') + (item.note ? ` • ${item.note}` : '')}
                </Text>
                <Text style={styles.itemSub}>{item.date || ''}</Text>
              </View>
              <Text style={[styles.amount, isExpense ? styles.red : styles.green]}>
                {sign}{money(item.amount, prefs)}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
        onPress={() => navigation.navigate('TxnEditor', { mode: 'add', accountId })}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  center: { flex: 1, backgroundColor: '#0B0D13', alignItems: 'center', justifyContent: 'center' },

  header: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  balance: { fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },
  red: { color: '#F87171' },
  green: { color: '#34D399' },

  rowItem: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTop: { color: '#E5E7EB', fontWeight: '700' },
  itemSub: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },
  amount: { marginLeft: 12, fontWeight: '800' },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    backgroundColor: '#2563EB',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 36, marginTop: -2 },
});
