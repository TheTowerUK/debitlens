// src/screens/TxnEditorScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import { useLayoutEffect } from 'react';

type Props = NativeStackScreenProps<RootStackParamList, 'TxnEditor'>;

const LAST_ACCOUNT_KEY = 'debitlens:lastAccountId';

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toNumberLoose(s: string) {
  // Accept "12", "12.50", "£12.50", "12,50"
  const cleaned = s.replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export default function TxnEditorScreen({ navigation, route }: Props) {
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const editId = route.params?.id;
  const presetAccountId = route.params?.accountId;
  const presetType = route.params?.type;

  const editingTxn = useMemo(() => {
    if (!editId) return undefined;
    return txs.find(t => t.id === editId);
  }, [editId, txs]);

  const isEditing = !!editingTxn;

  // ---- Local form state ----
  const [name, setName] = useState<string>(editingTxn?.name ?? '');
  const [amountText, setAmountText] = useState<string>(
    editingTxn ? String(editingTxn.amount ?? '') : ''
  );
  const [date, setDate] = useState<string>(editingTxn?.date ?? todayISO());
  const [type, setType] = useState<'income' | 'expense'>(
    (editingTxn?.type as any) ?? presetType ?? 'expense'
  );
  const [accountId, setAccountId] = useState<string>(
    editingTxn?.accountId ?? presetAccountId ?? ''
  );
  const [category, setCategory] = useState<string>(editingTxn?.category ?? '');
  const [description, setDescription] = useState<string>(
    editingTxn?.description ?? ''
  );

  // ---- Load best default account for NEW txns ----
  useEffect(() => {
    let cancelled = false;

    async function pickDefaultAccount() {
      if (isEditing) return; // don't override existing
      if (presetAccountId) return; // respect navigation param
      if (accountId) return; // already set

      try {
        const last = await AsyncStorage.getItem(LAST_ACCOUNT_KEY);
        if (cancelled) return;

        if (last && accounts.some(a => a.id === last)) {
          setAccountId(last);
          return;
        }

        // fallback to first non-archived account, else first
        const firstActive =
          accounts.find(a => !a.archived) ?? accounts[0] ?? undefined;
        if (firstActive?.id) setAccountId(firstActive.id);
      } catch {
        // ignore
      }
    }

    pickDefaultAccount();
    return () => {
      cancelled = true;
    };
  }, [accounts, accountId, isEditing, presetAccountId]);

    const handleDelete = () => {
    if (!isEditing || !editingTxn?.id) return;

    Alert.alert(
      'Delete transaction?',
      'This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              
              actions.deleteTransaction(editingTxn.id);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message ?? 'Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ---- Keep screen title sensible ----
  useLayoutEffect(() => {
    const title = isEditing ? 'Edit Transaction' : 'Add Transaction';

    navigation.setOptions({
      title,
      headerShown: true,
      headerStyle: { backgroundColor: '#020617' },
      headerTintColor: '#E5E7EB',
      headerTitleStyle: { fontWeight: '800' },
      headerBackVisible: true,

      // Optional: header delete button for edit mode
      headerRight: isEditing
        ? () => (
            <Pressable onPress={handleDelete} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: theme.negative, fontWeight: '900' }}>Delete</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, isEditing, handleDelete]);


  // ---- Validation + disabled save ----
  const amount = useMemo(() => toNumberLoose(amountText), [amountText]);

  const validation = useMemo(() => {
    const trimmedName = name.trim();
    if (!trimmedName) return { ok: false, reason: 'Please enter a name to enable Save' };


    if (!accountId) return { ok: false, reason: 'Choose an account' };

    // Basic ISO date sanity check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, reason: 'Date must be YYYY-MM-DD' };
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return { ok: false, reason: 'Invalid date' };

    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, reason: 'Enter a valid amount > 0' };
    }

    return { ok: true as const };
  }, [name, accountId, date, amount]);

  const canSave = validation.ok;

  async function persistLastAccount(id: string) {
    try {
      await AsyncStorage.setItem(LAST_ACCOUNT_KEY, id);
    } catch {
      // ignore
    }
  }

  const handleSave = async () => {
    if (!canSave) {
      Alert.alert('Can’t save yet', validation.reason);
      return;
    }

    const trimmedName = name.trim();
    const payload = {
      name: trimmedName,
      accountId,
      date,
      type,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      amount,
    };

    try {
      if (isEditing && editingTxn?.id) {
        
        actions.updateTransaction(editingTxn.id, payload);
      } else {
        
        actions.addTransaction(payload);
      }

      persistLastAccount(accountId); // fire-and-forget

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Payments');
      }

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Please try again.');
    }
  };

  // Simple “picker” without adding dependencies:
  const accountName = useMemo(() => {
    return accounts.find(a => a.id === accountId)?.name ?? '';
  }, [accounts, accountId]);

  const cycleAccount = () => {
    if (accounts.length === 0) return;
    const idx = Math.max(
      0,
      accounts.findIndex(a => a.id === accountId)
    );
    const next = accounts[(idx + 1) % accounts.length];
    if (next?.id) setAccountId(next.id);
  };

  return (
 
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      {/* Type toggle */}
      <View style={styles.segmentWrap}>
        <Pressable
          onPress={() => setType('expense')}
          style={[styles.segmentBtn, type === 'expense' && styles.segmentOn]}
        >
          <Text style={[styles.segmentText, type === 'expense' && styles.segmentTextOn]}>
            Expense
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType('income')}
          style={[styles.segmentBtn, type === 'income' && styles.segmentOn]}
        >
          <Text style={[styles.segmentText, type === 'income' && styles.segmentTextOn]}>
            Income
          </Text>
        </Pressable>
      </View>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Groceries"
        placeholderTextColor="#7b7b7b"
        style={styles.input}
        autoCorrect={false}
        returnKeyType="next"
      />

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <TextInput
        value={amountText}
        onChangeText={setAmountText}
        placeholder="e.g. 12.50"
        placeholderTextColor="#7b7b7b"
        style={styles.input}
        keyboardType={Platform.select({ ios: 'decimal-pad', android: 'numeric' }) as any}
        autoCorrect={false}
      />

      {/* Date */}
      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder={todayISO()}
        placeholderTextColor="#7b7b7b"
        style={styles.input}
        autoCorrect={false}
      />

      {/* Account (lightweight cycle) */}
      <Text style={styles.label}>Account</Text>
      <Pressable style={styles.accountPick} onPress={cycleAccount}>
        <Text style={styles.accountPickText}>
          {accountName || (accounts.length ? 'Tap to pick account' : 'No accounts yet')}
        </Text>
        {!!accounts.length && (
          <Text style={styles.accountPickHint}>Tap to cycle</Text>
        )}
      </Pressable>

      {/* Category */}
      <Text style={styles.label}>Category (optional)</Text>
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Food"
        placeholderTextColor="#7b7b7b"
        style={styles.input}
        autoCorrect={false}
      />

      {/* Description */}
      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Notes…"
        placeholderTextColor="#7b7b7b"
        style={[styles.input, styles.inputMultiline]}
        multiline
      />

      {/* Save disabled state + hint */}
      {!canSave && (
        <Text style={styles.subtle}>{validation.reason}</Text>
      )}

      <Pressable
        onPress={handleSave}
        style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
        disabled={!canSave}
      >
        <Text style={styles.primaryBtnText}>
          {isEditing ? 'Save changes' : 'Save transaction'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  wrap: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 24 },

  // --- Type toggle (matches pill styling) ---
  segmentWrap: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 14,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
  },
  segmentOn: {
    borderColor: theme.link,
  },
  segmentText: { color: '#E5E7EB', fontWeight: '800', fontSize: 13 },
  segmentTextOn: { color: theme.pillText },

  // --- Form ---
  label: {
    color: '#E5E7EB',
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 4,
  },

  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    marginBottom: 12,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  // --- Account picker (looks like a card/input) ---
  accountPick: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  accountPickText: { color: theme.text, fontWeight: '800' },
  accountPickHint: { color: theme.textDim, marginTop: 4 },

  // --- Validation ---
  validationBox: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  validationText: { color: theme.negative, fontWeight: '800' },
  subtle: { color: '#b1a76eff', marginTop: 4, marginBottom: 12 },


  // --- Primary / danger buttons (match card tone) ---
  primaryBtn: {
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#E5E7EB', fontWeight: '900' },

  dangerBtn: {
    marginTop: 12,
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  dangerBtnText: { color: theme.negative, fontWeight: '900' },
});

