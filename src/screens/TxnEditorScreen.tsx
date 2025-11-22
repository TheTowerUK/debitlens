// src/screens/TxnEditorScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'TxnEditor'>;

export default function TxnEditorScreen({ navigation, route }: Props) {
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const params = route.params ?? {};
  const editingId = params.id;
  const initialAccountId = params.accountId;
  const initialTypeParam: 'income' | 'expense' | undefined = params.type;

  const existing = useMemo(
    () => (editingId ? txs.find((t: any) => t.id === editingId) : undefined),
    [txs, editingId]
  );

  const [accountId, setAccountId] = useState<string | undefined>(
    existing?.accountId ?? initialAccountId ?? accounts[0]?.id
  );
  const [type, setType] = useState<'income' | 'expense'>(
    existing?.type ?? initialTypeParam ?? 'expense'
  );
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : ''
  );
  const [date, setDate] = useState(
    existing?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState(existing?.category ?? '');
  const [note, setNote] = useState(existing?.note ?? '');

  const screenTitle = existing ? 'Edit Transaction' : 'Add Transaction';

  const onSave = () => {
    if (!accounts.length) {
      Alert.alert(
        'No accounts',
        'Please add an account before creating transactions.'
      );
      return;
    }

    const chosenAccountId = accountId || accounts[0].id;
    const numericAmount = Number(amount);

    if (!numericAmount || isNaN(numericAmount)) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    const txDate =
      date && date.trim().length > 0
        ? date
        : new Date().toISOString().slice(0, 10);

    if (existing) {
      actions.updateTransaction(existing.id, {
        accountId: chosenAccountId,
        amount: numericAmount,
        type,
        date: txDate,
        category: category || null,
        note: note || null,
      });
    } else {
      actions.addTransaction({
        accountId: chosenAccountId,
        amount: numericAmount,
        type,
        date: txDate,
        category: category || null,
        note: note || null,
      });
    }

    navigation.goBack();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            actions.deleteTransaction(existing.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>{screenTitle}</Text>

        {/* Accounts */}
        <View style={styles.field}>
          <Text style={styles.label}>Account</Text>
          {accounts.length === 0 ? (
            <Text style={styles.helperText}>
              No accounts yet. Add an account from the Dashboard.
            </Text>
          ) : (
            <View style={styles.rowWrap}>
              {accounts.map((acc: any) => (
                <Pressable
                  key={acc.id}
                  style={[
                    styles.chip,
                    accountId === acc.id && styles.chipSelected,
                  ]}
                  onPress={() => setAccountId(acc.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      accountId === acc.id && styles.chipTextSelected,
                    ]}
                  >
                    {acc.name || 'Account'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.chip,
                type === 'expense' && styles.chipSelected,
              ]}
              onPress={() => setType('expense')}
            >
              <Text
                style={[
                  styles.chipText,
                  type === 'expense' && styles.chipTextSelected,
                ]}
              >
                Expense
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                type === 'income' && styles.chipSelected,
              ]}
              onPress={() => setType('income')}
            >
              <Text
                style={[
                  styles.chipText,
                  type === 'income' && styles.chipTextSelected,
                ]}
              >
                Income
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="DD-MM-YYYY"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={category ?? ''}
            onChangeText={setCategory}
            placeholder="e.g. Groceries, Rent, Salary"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Note */}
        <View style={styles.field}>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note ?? ''}
            onChangeText={setNote}
            placeholder="Optional description"
            placeholderTextColor="#6b7280"
            multiline
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          {existing && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          )}
          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveText}>
              {existing ? 'Save Changes' : 'Add Transaction'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 32,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#e5e7eb',
    marginBottom: 6,
    fontWeight: '500',
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#111827',
    color: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    columnGap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#f9fafb',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  deleteBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  deleteText: {
    color: '#f87171',
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
});
