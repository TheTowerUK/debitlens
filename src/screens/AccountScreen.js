// src/screens/AccountScreen.js
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert, Platform
} from 'react-native';
import { useApp } from '../state/AppState';

const fmt = (n) => Number(n || 0).toFixed(2);

export default function AccountScreen({ route, navigation }) {
  const { accountId } = route.params || {};
  const { state, selectors, actions } = useApp();

  const account = useMemo(
    () => (state.accounts || []).find(a => a.id === accountId),
    [state.accounts, accountId]
  );

  const balance = useMemo(
    () => account ? selectors.accountBalance(account.id) : 0,
    [selectors, account]
  );

  const txns = useMemo(() => {
    const all = state.transactions || [];
    return all
      .filter(t => t.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  }, [state.transactions, accountId]);

  if (!account) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>Account not found.</Text>
        <Pressable style={styles.btnSave} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const onDelete = (id) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await actions.deleteTransaction(id); }
      }
    ]);
  };

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>{account.name}</Text>
          <Text style={[
            styles.balance,
            { color: balance < 0 ? '#F87171' : '#34D399' }
          ]}>
            £{fmt(Math.abs(balance))}
          </Text>
        </View>
        <Pressable
          style={styles.btnSave}
          onPress={() => navigation.navigate('TxnEditor', { mode: 'add', accountId })}
        >
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
      </View>

      {/* LIST */}
      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('TxnEditor', { mode: 'edit', txnId: item.id })}
            onLongPress={() => onDelete(item.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cat}>
                {item.category}{item.note ? ` • ${item.note}` : ''}
              </Text>
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <Text style={[
              styles.amount,
              item.type === 'expense' ? styles.red : styles.green
            ]}>
              {item.type === 'expense' ? '-' : '+'}£{fmt(item.amount)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.subtle, { padding: 16 }]}>
            No transactions yet.
          </Text>
        }
      />

      {/* FAB */}

      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('TxnEditor', { mode: 'edit', txnId: item.id })}  // 👈 edit
          onLongPress={() => onDelete(item.id)}                                              // 👈 delete (optional)
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.cat}>{item.category}{item.note ? ` • ${item.note}` : ''}</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>
          <Text style={[
            styles.amount,
            item.type === 'expense' ? styles.red : styles.green
          ]}>
            {item.type === 'expense' ? '-' : '+'}£{Number(item.amount).toFixed(2)}
          </Text>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
        ]}
        onPress={() => navigation.navigate('TxnEditor', { mode: 'add', accountId })}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 12,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  balance: { fontSize: 20, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  cat: { color: '#E5E7EB', fontWeight: '700' },
  date: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },
  amount: { width: 120, textAlign: 'right', fontWeight: '800' },
  red: { color: '#DC2626' },
  green: { color: '#34D399' },
  sep: { height: 8 },

  center: { flex: 1, backgroundColor: '#0B0D13', alignItems: 'center', justifyContent: 'center', padding: 16 },
  subtle: { color: '#9CA3AF' },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },

  fab: {
    position: 'absolute', right: 20, bottom: 24,
    backgroundColor: '#2563EB', width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 32, marginTop: -2 },
});
