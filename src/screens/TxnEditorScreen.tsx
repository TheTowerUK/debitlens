// src/screens/TxnEditorScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'TxnEditor'>;

export default function TxnEditorScreen({ navigation, route }: Props) {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const allTxs = state.transactions || [];

  const txId = route.params?.txId;
  const initialAccountId = route.params?.accountId;

  const existingTx = txId
    ? allTxs.find(t => t.id === txId)
    : undefined;

  const [accountId, setAccountId] = useState<string>(
    existingTx?.accountId ||
      initialAccountId ||
      (accounts[0]?.id ?? '')
  );

  const [type, setType] = useState<'income' | 'expense'>(
    existingTx?.type || 'expense'
  );

  const [amount, setAmount] = useState(
    existingTx ? String(existingTx.amount) : ''
  );

  const [note, setNote] = useState(existingTx?.note || '');

  const [date, setDate] = useState(
    existingTx?.date || new Date().toISOString().slice(0, 10)
  );

  const isEditing = !!txId;

  if (isEditing && !existingTx) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.error}>
          Transaction not found.
        </Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const onSave = () => {
    const trimmedAmount = amount.trim();
    const n = Number(trimmedAmount);
    if (!accountId) {
      return Alert.alert('Select an account');
    }
    if (!trimmedAmount || Number.isNaN(n)) {
      return Alert.alert('Enter a valid amount');
    }
    if (!date.trim()) {
      return Alert.alert('Enter a date (YYYY-MM-DD)');
    }

    if (isEditing && txId) {
      actions.updateTransaction(txId, {
        accountId,
        amount: n,
        type,
        note: note.trim() || undefined,
        date: date.trim(),
      });
    } else {
      actions.addTransaction({
        accountId,
        amount: n,
        type,
        note: note.trim() || undefined,
        date: date.trim(),
      });
    }

    navigation.goBack();
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      <Text style={styles.h1}>
        {isEditing ? 'Edit transaction' : 'New transaction'}
      </Text>

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Type */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.row}>
        <Pressable
          style={[
            styles.pill,
            type === 'income' && styles.pillActive,
          ]}
          onPress={() => setType('income')}
        >
          <Text
            style={[
              styles.pillText,
              type === 'income' && styles.pillTextActive,
            ]}
          >
            Income
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.pill,
            type === 'expense' && styles.pillActive,
          ]}
          onPress={() => setType('expense')}
        >
          <Text
            style={[
              styles.pillText,
              type === 'expense' && styles.pillTextActive,
            ]}
          >
            Expense
          </Text>
        </Pressable>
      </View>

      {/* Account */}
      <Text style={styles.label}>Account</Text>
      <View style={styles.rowWrap}>
        {accounts.map(a => (
          <Pressable
            key={String(a.id)}
            style={[
              styles.pill,
              accountId === a.id && styles.pillActive,
            ]}
            onPress={() => setAccountId(a.id)}
          >
            <Text
              style={[
                styles.pillText,
                accountId === a.id && styles.pillTextActive,
              ]}
            >
              {a.name}
            </Text>
          </Pressable>
        ))}
        {accounts.length === 0 && (
          <Text style={styles.subtle}>
            No accounts yet – go back and create one first.
          </Text>
        )}
      </View>

      {/* Date */}
      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="2025-11-09"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Note */}
      <Text style={styles.label}>Note</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional description"
        placeholderTextColor="#6B7280"
        style={[styles.input, { height: 80 }]}
        multiline
      />

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.btn, styles.btnGhost]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={onSave}
        >
          <Text style={styles.btnText}>
            {isEditing ? 'Save changes' : 'Add transaction'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  label: {
    color: '#E5E7EB',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F9FAFB',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: '#2563EB',
  },
  pillText: {
    color: '#E5E7EB',
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#F9FAFB',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnGhost: {
    backgroundColor: '#1F2937',
  },
  btnText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  error: {
    color: '#FCA5A5',
    marginTop: 16,
  },
});
