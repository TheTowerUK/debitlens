// src/screens/HistoryScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const rows = useMemo(() => {
    const byId: Record<string, string> = {};
    accounts.forEach(a => {
      byId[a.id] = a.name || 'Account';
    });

    return [...txs]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(tx => ({
        ...tx,
        accountName: byId[tx.accountId] || 'Account',
      }));
  }, [accounts, txs]);

  const onDeleteTx = (id: string) => {
    Alert.alert(
      'Delete transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            actions.deleteTransaction(id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>History</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions yet.</Text>
        }
        renderItem={({ item }) => {
          const isIncome = item.type === 'income';
          const sign = isIncome ? '+' : '-';
          const amount = `${sign}£${Number(item.amount || 0).toFixed(2)}`;
          const d = item.date ? new Date(`${item.date}T00:00:00`) : null;

          return (
            <Pressable
              onLongPress={() => onDeleteTx(item.id)}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{item.accountName}</Text>
                <Text style={styles.rowSub}>
                  {item.note || (isIncome ? 'Income' : 'Expense')}
                  {d ? ` · ${d.toLocaleDateString()}` : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  isIncome ? styles.rowAmountIncome : styles.rowAmountExpense,
                ]}
              >
                {amount}
              </Text>
            </Pressable>
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
    alignItems: 'center',
    marginBottom: 12,
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  backLink: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  empty: {
    color: '#9CA3AF',
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#111827',
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
