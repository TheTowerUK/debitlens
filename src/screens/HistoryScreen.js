// src/screens/HistoryScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  Alert,
} from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

export default function HistoryScreen({ navigation }) {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const accounts = state?.accounts ?? [];
  const txns = state?.transactions ?? [];

  const [query, setQuery] = useState('');

  const byAccount = useMemo(() => {
    const m = {};
    for (const a of accounts) m[String(a.id)] = a;
    return m;
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (txns || [])
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.category || ''} ${t.note || ''} ${byAccount[t.accountId]?.name || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [txns, query, byAccount]);

  const onDelete = (id) => {
    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteTransaction(id) },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>History</Text>
      <Text style={styles.subtle}>Recent transactions</Text>

      {/* Search */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search category, note or account"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, index) => String(item.id ?? `${item.accountId}-${item.date}-${index}`)}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const isExpense = item.type === 'expense';
          const sign = isExpense ? '-' : '+';
          return (
            <Pressable
              style={styles.rowItem}
              onPress={() => navigation.navigate('TxnEditor', { mode: 'edit', txnId: item.id })}
              onLongPress={() => onDelete(item.id)}
            >
              {/* LEFT (constrained) */}
              <View style={styles.itemLeftWrap}>
                <Text style={styles.itemTop} numberOfLines={1} ellipsizeMode="tail">
                  {(item.category || '—') + (item.note ? ` • ${item.note}` : '')}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1} ellipsizeMode="tail">
                  {(byAccount[item.accountId]?.name || item.accountName || 'Account') + ' • ' + (item.date || '')}
                </Text>
              </View>

              {/* RIGHT (does not shrink) */}
              <Text style={[styles.amount, isExpense ? styles.red : styles.green]}>
                {sign}{money(item.amount, prefs)}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={[styles.subtle, { padding: 16 }]}>
            No transactions match the current filters.
          </Text>
        }
      />
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
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
  },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },

  rowItem: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeftWrap: {
    flex: 1,
    minWidth: 0,       // allows ellipsis instead of overflow
    paddingRight: 8,
  },
  itemTop: { color: '#E5E7EB', fontWeight: '700' },
  itemSub: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },

  amount: { color: '#E5E7EB', fontWeight: '800', flexShrink: 0 }, // don't shrink
  red: { color: '#F87171' },
  green: { color: '#34D399' },
});
