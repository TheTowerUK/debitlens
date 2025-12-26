// src/screens/TransferScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import { formatDateDDMMYYYY } from '../utils/formatDate';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

type TxType = 'income' | 'expense';

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

const TransferScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];

  const params = route.params ?? {};
  const initialFromId = params.fromAccountId;

  const [fromAccountId, setFromAccountId] = useState<string | undefined>(
    initialFromId ?? accounts[0]?.id
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(
    accounts.length > 1
      ? accounts.find((a: any) => a.id !== initialFromId)?.id ?? accounts[0]?.id
      : accounts[0]?.id
  );
  const [amount, setAmount] = useState<string>('');

  // UI date as DD/MM/YYYY
  const todayISO = new Date().toISOString();
  const [dateInput, setDateInput] = useState<string>(
    formatDateDDMMYYYY(todayISO)
  );

  const [note, setNote] = useState<string>('');

  const canTransfer = useMemo(() => accounts.length >= 2, [accounts.length]);

  const onSave = () => {
    if (!canTransfer) {
      Alert.alert(
        'Need more accounts',
        'You need at least two accounts to make a transfer.'
      );
      return;
    }

    if (!fromAccountId || !toAccountId) {
      Alert.alert('Select accounts', 'Please choose both from and to accounts.');
      return;
    }

    if (fromAccountId === toAccountId) {
      Alert.alert(
        'Same account',
        'From and to accounts must be different for a transfer.'
      );
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than zero.');
      return;
    }

    const parsedDate = parseDDMMYYYY(dateInput);
    if (!parsedDate) {
      Alert.alert(
        'Invalid date',
        'Please use format DD/MM/YYYY, e.g. 21/11/2025.'
      );
      return;
    }
    const isoDate = parsedDate.toISOString();

    const fromAcc = accounts.find((a: any) => a.id === fromAccountId);
    const toAcc = accounts.find((a: any) => a.id === toAccountId);

    const defaultNoteOut = `Transfer to ${toAcc?.name ?? 'account'}`;
    const defaultNoteIn = `Transfer from ${fromAcc?.name ?? 'account'}`;

    const commonNoteOut = note.trim() || defaultNoteOut;
    const commonNoteIn = note.trim() || defaultNoteIn;

    // Outgoing transaction (expense)
    actions.addTransaction({
      name: 'Transfer out',
      accountId: fromAccountId,
      amount: numericAmount,
      type: 'expense',
      date: isoDate,
      category: 'Transfer',
      description: commonNoteOut,
    });

    // Incoming transaction (income)
    actions.addTransaction({
      name: 'Transfer in',
      accountId: toAccountId,
      amount: numericAmount,
      type: 'income',
      date: isoDate,
      category: 'Transfer',
      description: commonNoteIn,
    });

    navigation.goBack();
  };


  const onCancel = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>Transfer between accounts</Text>
        <Text style={styles.subtle}>
          Move money from one account to another.
        </Text>

        {!canTransfer && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              You need at least two accounts before you can make a transfer.
            </Text>
          </View>
        )}

        {/* From Account */}
        <View style={styles.field}>
          <Text style={styles.label}>From account</Text>
          <View style={styles.rowWrap}>
            {accounts.map((acc: any) => (
              <Pressable
                key={acc.id}
                style={[
                  styles.chip,
                  fromAccountId === acc.id && styles.chipSelected,
                ]}
                onPress={() => setFromAccountId(acc.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    fromAccountId === acc.id && styles.chipTextSelected,
                  ]}
                >
                  {acc.name || 'Account'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* To Account */}
        <View style={styles.field}>
          <Text style={styles.label}>To account</Text>
          <View style={styles.rowWrap}>
            {accounts.map((acc: any) => (
              <Pressable
                key={acc.id}
                style={[
                  styles.chip,
                  toAccountId === acc.id && styles.chipSelected,
                ]}
                onPress={() => setToAccountId(acc.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    toAccountId === acc.id && styles.chipTextSelected,
                  ]}
                >
                  {acc.name || 'Account'}
                </Text>
              </Pressable>
            ))}
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

        {/* Note */}
        <View style={styles.field}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Move to savings"
            placeholderTextColor="#6b7280"
            multiline
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, !canTransfer && { opacity: 0.5 }]}
            onPress={onSave}
            disabled={!canTransfer}
          >
            <Text style={styles.saveText}>Transfer</Text>
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
    marginBottom: 4,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
  },
  warningBox: {
    backgroundColor: '#451a03',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  warningText: {
    color: '#fed7aa',
    fontSize: 13,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#e5e7eb',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.cardAlt,
    color: theme.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: {
    minHeight: 64,
    textAlignVertical: 'top',
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
    color: theme.text,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  cancelText: {
    color: '#e5e7eb',
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
    color: theme.text,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default TransferScreen;
