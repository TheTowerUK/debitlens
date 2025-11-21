// src/screens/RecentActivityScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'RecentActivity'>;

type TxnFilterType = 'all' | 'income' | 'expense' | 'transfer';

const RecentActivityScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useApp();
  const txs = state.transactions ?? [];

  const [filter, setFilter] = useState<TxnFilterType>('all');

  // Sorted newest → oldest
  const sortedTxs = useMemo(() => {
    const copy = [...txs];
    copy.sort(
      (x, y) =>
        (y.date ? Date.parse(y.date) : 0) -
        (x.date ? Date.parse(x.date) : 0)
    );
    return copy;
  }, [txs]);

  const filteredTxs = useMemo(() => {
    if (filter === 'all') return sortedTxs;

    if (filter === 'income') {
      return sortedTxs.filter((t) => t.type === 'income' && t.category !== 'Transfer');
    }

    if (filter === 'expense') {
      return sortedTxs.filter((t) => t.type === 'expense' && t.category !== 'Transfer');
    }

    // transfer
    return sortedTxs.filter((t) => t.category === 'Transfer');
  }, [sortedTxs, filter]);

  const filterLabel = (f: TxnFilterType): string => {
    switch (f) {
      case 'all':
        return 'All';
      case 'income':
        return 'Income';
      case 'expense':
        return 'Expense';
      case 'transfer':
        return 'Transfers';
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Recent activity</Text>
      <Text style={styles.subtle}>
        All your latest transactions in one place.
      </Text>

      {/* FILTER ROW */}
      <View style={styles.filterRow}>
        {(['all', 'income', 'expense', 'transfer'] as TxnFilterType[]).map(
          (f) => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                filter === f && styles.filterChipSelected,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f && styles.filterChipTextSelected,
                ]}
              >
                {filterLabel(f)}
              </Text>
            </Pressable>
          )
        )}
      </View>

      <Text style={styles.countLabel}>
        Showing {filteredTxs.length} transaction
        {filteredTxs.length === 1 ? '' : 's'}
      </Text>

      {filteredTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity</Text>
          <Text style={styles.emptyText}>
            No transactions for this filter yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            const sign = isIncome ? '+' : '-';
            const label =
              item.category === 'Transfer'
                ? 'Transfer'
                : item.category || 'Uncategorised';
            const note = item.note || '';
            return (
              <Pressable
                style={styles.txRow}
                onPress={() =>
                  navigation.navigate('TxnEditor', { id: item.id })
                }
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
                    item.category === 'Transfer'
                      ? styles.transferText
                      : isIncome
                      ? styles.incomeText
                      : styles.expenseText,
                  ]}
                >
                  {item.category === 'Transfer' ? '' : sign}
                  £{Number(item.amount).toFixed(2)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
};

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
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 8,
    marginBottom: 6,
    backgroundColor: '#020617',
  },
  filterChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterChipText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  countLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 10,
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
  incomeText: { color: '#22C55E' },
  expenseText: { color: '#F97373' },
  transferText: { color: '#38BDF8' }, // cyan-ish for transfers
});

export default RecentActivityScreen;
