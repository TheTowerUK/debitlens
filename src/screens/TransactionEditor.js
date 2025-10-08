// src/screens/TransactionEditor.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useApp } from '../state/AppState';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export default function TransactionEditor({ route, navigation }) {
  const { mode = 'add', accountId: initialAccountId, txnId } = route.params || {};
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const byId = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  const editing = mode === 'edit' && txnId;
  const existing = useMemo(
    () => (state.transactions || []).find(t => t.id === txnId),
    [state.transactions, txnId]
  );

  const [accountId, setAccountId] = useState(existing?.accountId || initialAccountId || accounts[0]?.id);
  const [type, setType] = useState(existing?.type || 'expense'); // 'expense' | 'income'
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState(existing?.category || (type === 'expense' ? 'General' : 'Income'));
  const [note, setNote] = useState(existing?.note || '');
  const [date, setDate] = useState(existing?.date || todayISO());

  useEffect(() => {
    // keep default category sensible if user flips type before typing
    if (!existing) {
      setCategory(type === 'expense' ? 'General' : 'Income');
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCycleAccount = () => {
    const ids = accounts.map(a => a.id);
    if (!ids.length) return;
    if (!accountId) return setAccountId(ids[0]);
    const idx = ids.indexOf(accountId);
    setAccountId(idx === -1 || idx === ids.length - 1 ? ids[0] : ids[idx + 1]);
  };

  const onSave = async () => {
    const amt = Number(String(amount).replace(',', '.'));
    if (!accountId) return Alert.alert('Choose account');
    if (!isFinite(amt) || amt <= 0) return Alert.alert('Invalid amount', 'Enter a number greater than 0.');
    const safeDate = isISO(date) ? date : todayISO();

    if (editing) {
      await actions.updateTransaction(existing.id, {
        accountId,
        accountName: byId[accountId]?.name,
        type,
        amount: Math.abs(amt),
        category: category || (type === 'expense' ? 'General' : 'Income'),
        note,
        date: safeDate,
      });
    } else {
      await actions.addTransaction({
        accountId,
        accountName: byId[accountId]?.name,
        type,
        amount: Math.abs(amt),
        category: category || (type === 'expense' ? 'General' : 'Income'),
        note,
        date: safeDate,
      });
    }
    navigation.goBack();
  };

  const onDelete = async () => {
    if (!editing) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await actions.deleteTransaction(existing.id);
          navigation.goBack();
        }
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.h1}>{editing ? 'Edit Transaction' : 'New Transaction'}</Text>

        {/* Type */}
        <View style={styles.row}>
          <Pressable
            style={[styles.pill, type === 'expense' && styles.pillActive]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.pillText, type === 'expense' && styles.pillTextActive]}>Expense</Text>
          </Pressable>
          <Pressable
            style={[styles.pill, type === 'income' && styles.pillActive]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.pillText, type === 'income' && styles.pillTextActive]}>Income</Text>
          </Pressable>
        </View>

        {/* Account */}
        <Pressable style={styles.accountBtn} onPress={onCycleAccount}>
          <Text style={styles.accountBtnText}>
            Account: {byId[accountId]?.name || 'Select'}
          </Text>
        </Pressable>

        {/* Amount */}
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={styles.input}
        />

        {/* Category */}
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="Category"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />

        {/* Note */}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />

        {/* Date */}
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />

        {/* Actions */}
        <View style={styles.row}>
          <Pressable style={styles.btnSave} onPress={onSave}>
            <Text style={styles.btnText}>{editing ? 'Save' : 'Add'}</Text>
          </Pressable>

          {editing && (
            <Pressable style={styles.btnDanger} onPress={onDelete}>
              <Text style={styles.btnText}>Delete</Text>
            </Pressable>
          )}

          <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13' },
  h1: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  pill: { backgroundColor: '#1F2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  accountBtn: { backgroundColor: '#1F2937', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 12 },
  accountBtnText: { color: '#fff', fontWeight: '700' },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  btnCancel: { backgroundColor: '#374151', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  btnDanger: { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
