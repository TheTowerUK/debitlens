// src/screens/TxnEditorScreen.tsx
import React, { useMemo, useState } from 'react';
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

  const initialAccountId =
    route.params?.accountId && accounts.some(a => a.id === route.params?.accountId)
      ? route.params.accountId
      : accounts[0]?.id ?? null;

  const initialMode: 'income' | 'expense' =
    route.params?.mode === 'income' || route.params?.mode === 'expense'
      ? route.params.mode
      : 'expense';

  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const [mode, setMode] = useState<'income' | 'expense'>(initialMode);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');

  const accountName = useMemo(
    () => accounts.find(a => a.id === accountId)?.name ?? 'Account',
    [accounts, accountId]
  );

  const onSave = () => {
    if (!accountId) {
      Alert.alert('No account', 'Please select an account.');
      return;
    }
    const n = parseFloat(amountText.trim());
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }

    // Date in YYYY-MM-DD format (today)
    const today = new Date().toISOString().slice(0, 10);

    actions.addTransaction({
      accountId,
      amount: n,
      type: mode,
      note: note.trim() || undefined,
      date: today,
    });

    navigation.goBack();
  };

  if (!accounts.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>You need an account first.</Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.btnText}>Go to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>New transaction</Text>
      <Text style={styles.subtle}>
        {mode === 'income'
          ? `Adding income to ${accountName}.`
          : `Adding an expense from ${accountName}.`}
      </Text>

      {/* Account picker */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.pillRow}>
          {accounts.map(a => (
            <Pressable
              key={a.id}
              onPress={() => setAccountId(a.id)}
              style={[
                styles.pill,
                accountId === a.id && styles.pillActive,
              ]}
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
        </View>
      </View>

      {/* Type & amount */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Type</Text>
        <View style={styles.pillRow}>
          <Pressable
            style={[
              styles.pill,
              mode === 'expense' && styles.pillActiveExpense,
            ]}
            onPress={() => setMode('expense')}
          >
            <Text
              style={[
                styles.pillText,
                mode === 'expense' && styles.pillTextActive,
              ]}
            >
              Expense
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.pill,
              mode === 'income' && styles.pillActiveIncome,
            ]}
            onPress={() => setMode('income')}
          >
            <Text
              style={[
                styles.pillText,
                mode === 'income' && styles.pillTextActive,
              ]}
            >
              Income
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
          Amount
        </Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="e.g. 42.50"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />
      </View>

      {/* Note */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Groceries, rent, salary..."
          placeholderTextColor="#6B7280"
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          multiline
        />
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
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
          <Text style={styles.btnText}>Save</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  center: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  pillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pillActiveExpense: {
    backgroundColor: '#B91C1C',
    borderColor: '#B91C1C',
  },
  pillActiveIncome: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  pillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#F9FAFB',
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F9FAFB',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnGhost: {
    backgroundColor: '#0B1120',
  },
  btnText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 13,
  },
});
