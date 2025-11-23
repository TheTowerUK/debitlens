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
import { useApp, type Transaction } from '../state/AppProvider';
import { formatDateDDMMYYYY } from '../utils/formatDate';

type Props = NativeStackScreenProps<RootStackParamList, 'TxnEditor'>;

// Parse DD/MM/YYYY into a Date (or null if invalid)
function parseDDMMYYYY(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;

  const [ddStr, mmStr, yyyyStr] = parts;
  const day = Number(ddStr);
  const month = Number(mmStr);
  const year = Number(yyyyStr);

  if (!day || !month || !year) return null;
  if (year < 1900 || year > 9999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  d.setHours(0, 0, 0, 0);
  return d;
}

const TxnEditorScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const params = route.params ?? {};
  const editingId = params.id;
  const initialTypeParam = params.type;

  const existing: Transaction | undefined = useMemo(
    () => (editingId ? txs.find((t) => t.id === editingId) : undefined),
    [txs, editingId]
  );

  // Type (income/expense)
  const [type, setType] = useState<'income' | 'expense'>(
    existing?.type ?? initialTypeParam ?? 'expense'
  );

  // Account selection
  const [accountId, setAccountId] = useState<string | undefined>(
    existing?.accountId ??
      params.accountId ??
      (accounts.length ? accounts[0].id : undefined)
  );

  // Amount
  const [amountInput, setAmountInput] = useState<string>(
    existing ? String(existing.amount) : ''
  );

  // Date (DD/MM/YYYY for UI)
  const initialDateISO =
    existing?.date ?? new Date().toISOString();

  const [dateInput, setDateInput] = useState<string>(
    formatDateDDMMYYYY(initialDateISO) // gives DD/MM/YYYY
  );

  // Category & note
  const [category, setCategory] = useState<string>(
    existing?.category ?? ''
  );
  const [note, setNote] = useState<string>(
    existing?.note ?? ''
  );

  const isEditing = !!existing;
  const screenTitle = isEditing ? 'Edit transaction' : 'Add transaction';

  const handleSave = () => {
    const numericAmount = Number(amountInput);

    if (!numericAmount || isNaN(numericAmount)) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (!accounts.length) {
      Alert.alert(
        'No accounts',
        'Please create an account before adding transactions.'
      );
      return;
    }

    const chosenAccountId = accountId ?? accounts[0].id;

    // Parse DD/MM/YYYY input
    const parsedDate = parseDDMMYYYY(dateInput);
    if (!parsedDate) {
      Alert.alert(
        'Invalid date',
        'Please use format DD/MM/YYYY, e.g. 21/11/2025.'
      );
      return;
    }
    const isoDate = parsedDate.toISOString();

    const cleanCategory = category.trim();
    const cleanNote = note.trim();

    const patch: Omit<Transaction, 'id'> = {
      accountId: chosenAccountId,
      amount: numericAmount,
      type,
      date: isoDate,
      category: cleanCategory || null,
      note: cleanNote || null,
    };

    if (isEditing && existing) {
      actions.updateTransaction(existing.id, patch);
    } else {
      actions.addTransaction(patch);
    }

    navigation.goBack();
  };

  const handleDelete = () => {
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

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>{screenTitle}</Text>

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

        {/* Account */}
        <View style={styles.field}>
          <Text style={styles.label}>Account</Text>
          {accounts.length === 0 ? (
            <Text style={styles.helperText}>
              No accounts yet. Add an account from the Dashboard first.
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

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Date (DD/MM/YYYY) */}
        <View style={styles.field}>
          <Text style={styles.label}>Date (DD/MM/YYYY)</Text>
          <TextInput
            style={styles.input}
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category (optional)</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Groceries, Rent, Salary"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Note */}
        <View style={styles.field}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Details or description"
            placeholderTextColor="#6b7280"
            multiline
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          {isEditing && (
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          )}

          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveText}>
              {isEditing ? 'Save' : 'Add'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
    marginBottom: 20,
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
    minHeight: 72,
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
    columnGap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: '#111827',
  },
  cancelText: {
    color: '#e5e7eb',
    fontWeight: '500',
  },
  deleteBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f87171',
    backgroundColor: '#111827',
  },
  deleteText: {
    color: '#f87171',
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  saveText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default TxnEditorScreen;
