// src/screens/TxnEditorScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform, Alert } from 'react-native';
import { useApp } from '../state/AppState';

const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TxnEditorScreen({ route, navigation }) {
  const { state, actions } = useApp();
  const { mode = 'add', txnId = null, accountId = null } = route.params || {};

  const accounts = state?.accounts || [];
  const txns = state?.transactions || [];
  const existing = useMemo(() => txns.find(t => t.id === txnId) || null, [txns, txnId]);

  // form state
  const [type, setType] = useState(existing?.type || 'expense'); // 'expense' | 'income'
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date || todayISO());
  const [category, setCategory] = useState(existing?.category || '');
  const [note, setNote] = useState(existing?.note || '');
  const [acctId, setAcctId] = useState(existing?.accountId || accountId || (accounts[0]?.id || null));

  useEffect(() => {
    navigation.setOptions({ title: mode === 'edit' ? 'Edit Transaction' : 'Add Transaction' });
  }, [mode, navigation]);

  const onSave = async () => {
    const amt = Number(amount);
    if (!acctId) return Alert.alert('Account required', 'Please pick an account first.');
    if (!isFinite(amt) || amt <= 0) return Alert.alert('Amount', 'Enter a positive amount.');
    if (!isISO(date)) return Alert.alert('Date', 'Use YYYY-MM-DD format.');

    const payload = {
      id: existing?.id,
      accountId: acctId,
      type,
      amount: amt,
      date,
      category: category.trim() || (type === 'expense' ? 'General' : 'Income'),
      note: note.trim(),
    };

    if (mode === 'edit' && existing) {
      await actions.updateTransaction(payload);
    } else {
      await actions.addTransaction(payload);
    }
    navigation.goBack();
  };

  const onDelete = async () => {
    if (!existing) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await actions.deleteTransaction(existing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{mode === 'edit' ? 'Edit' : 'Add'} Transaction</Text>

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

      {/* Account (simple cycler) */}
      <Pressable
        style={styles.accountBtn}
        onPress={() => {
          if (!accounts.length) return;
          if (!acctId) return setAcctId(accounts[0].id);
          const ids = accounts.map(a => a.id);
          const i = ids.indexOf(acctId);
          setAcctId(i === -1 || i === ids.length - 1 ? ids[0] : ids[i + 1]);
        }}
      >
        <Text style={styles.accountBtnText}>
          Account: {accounts.find(a => a.id === acctId)?.name || '—'}
        </Text>
      </Pressable>

      {/* Amount */}
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="Amount (e.g., 12.34)"
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

      {/* Category */}
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder={type === 'expense' ? 'Category (e.g., Groceries)' : 'Category (e.g., Salary)'}
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

      {/* Actions */}
      <View style={styles.row}>
        <Pressable style={[styles.btnSave, { marginRight: 8 }]} onPress={onSave}>
          <Text style={styles.btnText}>{mode === 'edit' ? 'Save' : 'Add'}</Text>
        </Pressable>
        <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
      </View>

      {mode === 'edit' && existing && (
        <Pressable style={[styles.btnDanger, { marginTop: 10 }]} onPress={onDelete}>
          <Text style={styles.btnText}>Delete</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16, paddingTop: Platform.OS === 'ios' ? 44 : 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },

  pill: { backgroundColor: '#1F2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginRight: 8 },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  accountBtn: { backgroundColor: '#1F2937', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginTop: 8 },
  accountBtnText: { color: '#fff', fontWeight: '700' },

  input: {
    backgroundColor: '#0F172A', color: '#fff', borderColor: '#1F2937',
    borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8,
  },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnCancel: { backgroundColor: '#6B7280', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnDanger: { backgroundColor: '#7F1D1D', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
