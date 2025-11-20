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
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

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
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
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

    const trimmedDate = date.trim();
    const d = trimmedDate ? new Date(trimmedDate) : new Date();
    if (isNaN(d.getTime())) {
      Alert.alert('Invalid date', 'Please use format YYYY-MM-DD.');
      return;
    }
    d.setHours(0, 0, 0, 0);
    const isoDate = d.toISOString();

    const fromAcc = accounts.find((a: any) => a.id === fromAccountId);
    const toAcc = accounts.find((a: any) => a.id === toAccountId);

    const defaultNoteOut = `Transfer to ${toAcc?.name ?? 'account'}`;
    const defaultNoteIn = `Transfer from ${fromAcc?.name ?? 'account'}`;

    const commonNoteOut = note.trim() || defaultNoteOut;
    const commonNoteIn = note.trim() || defaultNoteIn;

    // Outgoing transaction (expense)
    actions.addTransaction({
      accountId: fromAccountId,
      amount: numericAmount,
      type: 'expense',
      date: isoDate,
      category: 'Transfer',
      note: commonNoteOut,
    });

    // Incoming transaction (income)
    actions.addTransaction({
      accountId: toAccountId,
      amount: numericAmount,
      type: 'income',
      date: isoDate,
      category: 'Transfer',
      note: commonNoteIn,
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

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
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
            style={[
              styles.saveBtn,
              !canTransfer && { opacity: 0.5 },
            ]}
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
    color: '#9CA3AF',
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
    backgroundColor: '#111827',
    color: '#f9fafb',
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
    color: '#f9fafb',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
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
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default TransferScreen;
