// src/screens/PaymentEditorScreen.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TxnEditor'>;

type TxType = 'income' | 'expense';

function formatGBP(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  } catch {
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return `${sign}£${abs.toFixed(2)}`;
  }
}

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidISODate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

export default function PaymentEditorScreen({ navigation, route }: Props) {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const id = (route.params as any)?.id as string | undefined;
  const existing = useMemo(() => (id ? txs.find((t) => t.id === id) : undefined), [id, txs]);

  // If there are no accounts, prevent creating a transaction (needs accountId)
  const hasAccounts = accounts.length > 0;

  // Defaults
  const defaultAccountId = accounts[0]?.id ?? '';
  const [accountId, setAccountId] = useState(existing?.accountId ?? defaultAccountId);
  const [type, setType] = useState<TxType>((existing?.type as TxType) ?? 'expense');
  const [date, setDate] = useState(existing?.date ?? isoToday());
  const [amountText, setAmountText] = useState(
    existing ? String(Number(existing.amount ?? 0).toFixed(2)) : ''
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');

  // If user navigates here before accounts load, keep accountId sensible
  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const title = existing ? 'Edit payment' : 'Add payment';

  const selectedAccountName = useMemo(() => {
    const a = accounts.find((x) => x.id === accountId);
    return a?.name || 'Account';
  }, [accounts, accountId]);

  const cycleAccount = (dir: 1 | -1) => {
    if (accounts.length <= 1) return;
    const idx = accounts.findIndex((a) => a.id === accountId);
    const nextIdx = idx === -1 ? 0 : (idx + dir + accounts.length) % accounts.length;
    setAccountId(accounts[nextIdx].id);
  };

  const parsedAmount = useMemo(() => {
    // allow "12" or "12.50"
    const v = Number(String(amountText).replace(/,/g, '').trim());
    return isFinite(v) ? v : NaN;
  }, [amountText]);

  const canSave =
    hasAccounts &&
    accountId &&
    (type === 'income' || type === 'expense') &&
    isValidISODate(date) &&
    isFinite(parsedAmount) &&
    parsedAmount > 0;

  const handleSave = () => {
    if (!hasAccounts) {
      Alert.alert('No accounts', 'Create an account first.');
      return;
    }
    if (!accountId) {
      Alert.alert('Missing account', 'Please choose an account.');
      return;
    }
    if (!isValidISODate(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD (e.g. 2025-12-23).');
      return;
    }
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive amount (e.g. 12.50).');
      return;
    }

    const payload = {
      accountId,
      type,
      date,
      amount: parsedAmount,
      name: name.trim() || undefined,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
    };

    if (existing) {
      actions.updateTransaction(existing.id, payload);
    } else {
      actions.addTransaction(payload as any);
    }

    navigation.goBack();
  };

  const handleDelete = () => {
    if (!existing) return;

    Alert.alert('Delete payment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          actions.deleteTransaction(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Payment Editor</Text>
            <Text style={styles.subtle}>
              {existing ? 'Update details and save' : 'Create a new transaction'}
            </Text>
          </View>

          <View style={styles.headerPillsRow}>
            {existing ? (
              <Pressable
                style={[styles.headerPill, styles.dangerPill]}
                onPress={handleDelete}
                hitSlop={8}
              >
                <Text style={styles.headerPillText}>Delete</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.headerPill} onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.headerPillText}>Back</Text>
            </Pressable>
          </View>
        </View>

        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>

          {!hasAccounts ? (
            <Text style={styles.emptyText}>No accounts yet. Create an account first.</Text>
          ) : (
            <View style={styles.accountPickerRow}>
              <Pressable style={styles.smallBtn} onPress={() => cycleAccount(-1)} hitSlop={8}>
                <Text style={styles.smallBtnText}>◀</Text>
              </Pressable>

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.pickerValue}>{selectedAccountName}</Text>
                <Text style={styles.pickerSub}>Tap arrows to change</Text>
              </View>

              <Pressable style={styles.smallBtn} onPress={() => cycleAccount(1)} hitSlop={8}>
                <Text style={styles.smallBtnText}>▶</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Type + Date + Amount */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>

          <View style={styles.pillsRow}>
            <Pressable
              style={[styles.pill, type === 'expense' && styles.pillActive]}
              onPress={() => setType('expense')}
            >
              <Text style={[styles.pillText, type === 'expense' && styles.pillTextActive]}>
                Expense
              </Text>
            </Pressable>

            <Pressable
              style={[styles.pill, type === 'income' && styles.pillActive]}
              onPress={() => setType('income')}
            >
              <Text style={[styles.pillText, type === 'income' && styles.pillTextActive]}>
                Income
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="2025-12-23"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amountText}
            onChangeText={setAmountText}
            placeholder="12.50"
            placeholderTextColor="#6B7280"
            keyboardType="decimal-pad"
          />

          <Text style={styles.hint}>
            You’ll see it as {type === 'income' ? '+' : '-'}
            {isFinite(parsedAmount) ? formatGBP(parsedAmount) : '£0.00'}.
          </Text>
        </View>

        {/* Optional fields */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Optional</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Grocery shop"
            placeholderTextColor="#6B7280"
          />

          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Groceries"
            placeholderTextColor="#6B7280"
            autoCapitalize="sentences"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional notes…"
            placeholderTextColor="#6B7280"
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Save */}
        <View style={styles.card}>
          <Pressable
            style={[styles.btnPrimary, !canSave && styles.btnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.btnPrimaryText}>
              {existing ? 'Save changes' : 'Add payment'}
            </Text>
          </Pressable>

          {!canSave ? (
            <Text style={styles.hint}>
              Required: account, valid date, positive amount.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  wrap: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 24 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 10,
  },
  h1: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginTop: 4 },

  headerPillsRow: { flexDirection: 'row', columnGap: 8, marginBottom: 14 },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  dangerPill: { borderColor: '#F97373' },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  emptyText: { color: '#9CA3AF', marginTop: 10 },

  accountPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    marginTop: 12,
  },
  pickerValue: { color: '#F9FAFB', fontWeight: '800', fontSize: 16 },
  pickerSub: { color: '#9CA3AF', marginTop: 4, fontSize: 12 },

  smallBtn: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { color: '#BFDBFE', fontWeight: '900', fontSize: 14 },

  pillsRow: { flexDirection: 'row', columnGap: 8, marginTop: 10 },

  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  pillActive: { borderColor: '#93C5FD' },
  pillText: { color: '#E5E7EB', fontWeight: '800' },
  pillTextActive: { color: '#BFDBFE' },

  label: { color: '#9CA3AF', marginTop: 12, fontWeight: '700' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F9FAFB',
  },
  inputMultiline: {
    minHeight: 90,
  },

  hint: { color: '#9CA3AF', marginTop: 10, fontSize: 12 },

  btnPrimary: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: 'white', fontWeight: '900' },
});
