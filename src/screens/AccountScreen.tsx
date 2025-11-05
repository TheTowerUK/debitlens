// src/screens/AccountScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const { state, selectors, actions } = useApp();

  const account = state.accounts.find(a => a.id === accountId);
  const txs = selectors.transactionsForAccount(accountId);
  const balance = selectors.accountBalance(accountId);

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');

  if (!account) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Account not found</Text>
        <Pressable style={styles.btnPrimary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnPrimaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const addTx = async (type: 'income' | 'expense') => {
    const value = parseFloat(amountText.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    try {
      await actions.addTransaction({
        accountId,
        amount: value,
        type,
        note: note.trim() || undefined,
      });
      setAmountText('');
      setNote('');
    } catch (e: any) {
      console.warn('addTransaction failed', e);
      Alert.alert('Error', e?.message || 'Could not add transaction');
    }
  };

  const deleteTx = (id: string) => {
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

  const deleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This will also remove all its transactions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await actions.deleteAccount(accountId);
              navigation.goBack();
            } catch (e) {
              console.warn('deleteAccount failed', e);
              Alert.alert('Error', 'Could not delete account');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{account.name}</Text>
          <Text style={styles.subtle}>
            Created {new Date(account.createdAt).toLocaleString()}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[
              styles.balance,
              { color: balance >= 0 ? '#34D399' : '#F87171' },
            ]}
          >
            £{Math.abs(balance).toFixed(2)}
          </Text>
          <Text style={styles.balanceLabel}>
            {balance >= 0 ? 'Net income' : 'Net spend'}
          </Text>
        </View>
      </View>

      {/* ADD TRANSACTION */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add transaction</Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          placeholder="Amount (e.g. 20.50)"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable
            style={[styles.btnPrimary, { flex: 1, marginRight: 6 }]}
            onPress={() => addTx('income')}
          >
            <Text style={styles.btnPrimaryText}>Add income</Text>
          </Pressable>
          <Pressable
            style={[styles.btnDanger, { flex: 1, marginLeft: 6 }]}
            onPress={() => addTx('expense')}
          >
            <Text style={styles.btnPrimaryText}>Add expense</Text>
          </Pressable>
        </View>
      </View>

      {/* TRANSACTIONS LIST */}
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Pressable style={styles.deleteAccountPill} onPress={deleteAccount}>
            <Text style={styles.deleteAccountText}>Delete account</Text>
          </Pressable>
        </View>

        {txs.length === 0 && (
          <Text style={styles.empty}>No transactions yet.</Text>
        )}

        {txs.map(t => {
          const isIncome = t.type === 'income';
          const sign = isIncome ? '+' : '-';
          const colour = isIncome ? '#34D399' : '#F87171';
          const dt = new Date(t.date);
          return (
            <Pressable
              key={t.id}
              style={styles.txRow}
              onLongPress={() => deleteTx(t.id)}
            >
              <View style={styles.txLeft}>
                <Text style={styles.txNote}>{t.note || '(no note)'}</Text>
                <Text style={styles.txDate}>{dt.toLocaleString()}</Text>
              </View>
              <Text style={[styles.txAmount, { color: colour }]}>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginTop: 4 },
  balance: { fontSize: 22, fontWeight: '800' },
  balanceLabel: { color: '#9CA3AF', fontSize: 12 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', marginTop: 4 },

  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },

  scroll: { flex: 1, marginTop: 8 },
  empty: { color: '#6B7280', marginTop: 4 },

  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deleteAccountPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  deleteAccountText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },

  txRow: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: { flexShrink: 1, paddingRight: 8 },
  txNote: { color: '#E5E7EB', fontWeight: '600' },
  txDate: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '800' },
});
