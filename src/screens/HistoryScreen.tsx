// src/screens/HistoryScreen.tsx
import React, { useMemo, useState } from 'react';
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
import { useApp } from '../state/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

type TypeFilter = 'all' | 'income' | 'expense';
type AccountFilter = 'all' | string;

export default function HistoryScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');

  const accountNameById: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    accounts.forEach(a => {
      map[a.id] = a.name || 'Account';
    });
    return map;
  }, [accounts]);

  const filteredTxs = useMemo(() => {
    return [...txs]
      .filter(t => {
        if (typeFilter === 'income') return t.type === 'income';
        if (typeFilter === 'expense') return t.type !== 'income';
        return true;
      })
      .filter(t => {
        if (accountFilter === 'all') return true;
        return t.accountId === accountFilter;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [txs, typeFilter, accountFilter]);

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>History</Text>
          <Text style={styles.subtle}>
            All transactions with quick filters
          </Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filtersBlock}>
        <Text style={styles.filterLabel}>Type</Text>
        <View style={styles.pillRow}>
          <Pressable
            style={[
              styles.pill,
              typeFilter === 'all' && styles.pillActive,
            ]}
            onPress={() => setTypeFilter('all')}
          >
            <Text
              style={[
                styles.pillText,
                typeFilter === 'all' && styles.pillTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.pill,
              typeFilter === 'income' && styles.pillActive,
            ]}
            onPress={() => setTypeFilter('income')}
          >
            <Text
              style={[
                styles.pillText,
                typeFilter === 'income' && styles.pillTextActive,
              ]}
            >
              Income
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.pill,
              typeFilter === 'expense' && styles.pillActive,
            ]}
            onPress={() => setTypeFilter('expense')}
          >
            <Text
              style={[
                styles.pillText,
                typeFilter === 'expense' && styles.pillTextActive,
              ]}
            >
              Expense
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.filterLabel, { marginTop: 12 }]}>Account</Text>
        <View style={styles.pillRow}>
          <Pressable
            style={[
              styles.pill,
              accountFilter === 'all' && styles.pillActive,
            ]}
            onPress={() => setAccountFilter('all')}
          >
            <Text
              style={[
                styles.pillText,
                accountFilter === 'all' && styles.pillTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
          {accounts.map(a => (
            <Pressable
              key={a.id}
              style={[
                styles.pill,
                accountFilter === a.id && styles.pillActive,
              ]}
              onPress={() => setAccountFilter(a.id)}
            >
              <Text
                style={[
                  styles.pillText,
                  accountFilter === a.id && styles.pillTextActive,
                ]}
              >
                {a.name || 'Account'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filteredTxs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions match the filters.</Text>
        }
        renderItem={({ item }) => {
          const isIncome = item.type === 'income';
          const sign = isIncome ? '+' : '-';
          const amt = Number(item.amount || 0);
          const d = item.date ? new Date(`${item.date}T00:00:00`) : null;
          const accName = accountNameById[item.accountId] || 'Account';

          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>
                  {item.note || (isIncome ? 'Income' : 'Expense')}
                </Text>
                <Text style={styles.rowSub}>
                  {accName}
                  {d ? ` · ${d.toLocaleDateString()}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  isIncome ? styles.rowAmountIncome : styles.rowAmountExpense,
                ]}
              >
                {sign}£{amt.toFixed(2)}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  backLink: {
    color: '#93C5FD',
    fontWeight: '600',
  },

  filtersBlock: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  filterLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#020617',
  },
  pillActive: {
    backgroundColor: '#2563EB',
  },
  pillText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#F9FAFB',
  },

  empty: {
    color: '#9CA3AF',
    marginTop: 16,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1F2937',
  },
  rowLeft: {
    flexShrink: 1,
    paddingRight: 8,
  },
  rowTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  rowSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowAmountIncome: {
    color: '#4ADE80',
  },
  rowAmountExpense: {
    color: '#F97373',
  },
});
