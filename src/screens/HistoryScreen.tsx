// src/screens/HistoryScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const { state, selectors, actions } = useApp();
  const accounts = state.accounts || [];
  const txsAll = state.transactions || [];

  // helper: lookup account name by id
  const accountNameFor = (id: string): string => {
    const acc = accounts.find(a => a.id === id);
    return acc?.name || 'Unknown';
  };

  const sorted = [...txsAll].sort((a, b) => b.date.localeCompare(a.date));

  const totals = sorted.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );

  const onDeleteTx = (id: string) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await actions.deleteTransaction(id);
          } catch (e) {
            console.warn('deleteTransaction failed', e);
            Alert.alert('Error', 'Could not delete transaction');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>History</Text>
      <Text style={styles.subtle}>
        All transactions across your accounts.
      </Text>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, { color: '#34D399' }]}>
            £{totals.income.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Expense</Text>
          <Text style={[styles.summaryValue, { color: '#F87171' }]}>
            £{totals.expense.toFixed(2)}
          </Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: totals.income - totals.expense >= 0 ? '#34D399' : '#F87171' },
            ]}
          >
            £{(totals.income - totals.expense).toFixed(2)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
        {sorted.length === 0 && (
          <Text style={styles.empty}>No transactions yet.</Text>
        )}

        {sorted.map(t => {
          const isIncome = t.type === 'income';
          const sign = isIncome ? '+' : '-';
          const colour = isIncome ? '#34D399' : '#F87171';
          const dt = new Date(t.date);
          return (
            <Pressable
              key={t.id}
              style={styles.row}
              onLongPress={() => onDeleteTx(t.id)}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowNote}>
                  {t.note || '(no note)'}
                </Text>
                <Text style={styles.rowSub}>
                  {accountNameFor(t.accountId)} · {dt.toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: colour }]}>
                {sign}£{t.amount.toFixed(2)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: { color: '#9CA3AF', fontSize: 12 },
  summaryValue: { color: '#E5E7EB', fontSize: 16, fontWeight: '800' },

  scroll: { flex: 1, marginTop: 4 },
  empty: { color: '#6B7280', marginTop: 8 },

  row: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: { flexShrink: 1, paddingRight: 8 },
  rowNote: { color: '#E5E7EB', fontWeight: '600' },
  rowSub: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: '800' },
});
