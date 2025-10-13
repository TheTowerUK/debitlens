// src/screens/TxnEditorScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

const pad = n => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

export default function TxnEditorScreen({ route, navigation }) {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const mode = route.params?.mode || 'add'; // 'add' | 'edit'
  const editId = route.params?.txnId || null;
  const presetAccountId = route.params?.accountId ? String(route.params.accountId) : null;

  const accounts = state?.accounts ?? [];
  const txns = state?.transactions ?? [];
  const existing = useMemo(
    () => (mode === 'edit' ? txns.find(t => t.id === editId) || null : null),
    [mode, editId, txns]
  );

  // form state
  const [type, setType] = useState(existing?.type || 'expense'); // 'expense' | 'income'
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date || todayISO());
  const [category, setCategory] = useState(existing?.category || (type === 'expense' ? 'General' : 'Income'));
  const [note, setNote] = useState(existing?.note || '');
  const [accountId, setAccountId] = useState(
    existing?.accountId ? String(existing.accountId) :
    presetAccountId ?? (accounts[0] ? String(accounts[0].id) : '')
  );

  const cycleAccount = () => {
    if (!accounts.length) return;
    if (!accountId) return setAccountId(String(accounts[0].id));
    const ids = accounts.map(a => String(a.id));
    const i = ids.indexOf(String(accountId));
    setAccountId(i === -1 || i === ids.length - 1 ? ids[0] : ids[i + 1]);
  };

  const onSave = async () => {
    const amt = Number(amount);
    if (!accountId) return Alert.alert('Account', 'Choose an account');
    if (!isFinite(amt) || amt <= 0) return Alert.alert('Amount', 'Enter a positive amount');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Alert.alert('Date', 'Use YYYY-MM-DD');

    const payload = {
      accountId: String(accountId),
      type,
      amount: amt,
      date,
      category: category?.trim() || (type === 'expense' ? 'General' : 'Income'),
      note: note?.trim(),
    };

    try {
      if (mode === 'edit' && existing) {
        await actions.updateTransaction({ ...payload, id: existing.id });
      } else {
        await actions.addTransaction(payload);
      }
      navigation.goBack();
    } catch (e) {
      console.warn('[txnEditor] save failed', e);
      Alert.alert('Save failed', 'Please try again.');
    }
  };

  const onDelete = async () => {
    if (!(mode === 'edit' && existing)) return;
    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await actions.deleteTransaction(existing.id);
        navigation.goBack();
      }},
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{mode === 'edit' ? 'Edit Transaction' : 'Add Transaction'}</Text>

      {/* Type */}
      <View style={styles.row}>
        <Pressable style={[styles.pill, type==='expense' && styles.pillActive]} onPress={() => { setType('expense'); if(!category) setCategory('General'); }}>
          <Text style={[styles.pillText, type==='expense' && styles.pillTextActive]}>Expense</Text>
        </Pressable>
        <Pressable style={[styles.pill, type==='income' && styles.pillActive]} onPress={() => { setType('income'); if(!category) setCategory('Income'); }}>
          <Text style={[styles.pillText, type==='income' && styles.pillTextActive]}>Income</Text>
        </Pressable>
      </View>

      {/* Account cycler */}
      <Pressable style={styles.accountBtn} onPress={cycleAccount}>
        <Text style={styles.accountBtnText}>
          Account: {accounts.find(a => String(a.id) === String(accountId))?.name || '—'}
        </Text>
      </Pressable>

      {/* Amount */}
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="Amount"
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

      {/* Category / Note */}
      <TextInput
        value={category}
        onChangeText={setCategory}
        placeholder={type==='expense' ? 'Category (e.g., Groceries)' : 'Category (e.g., Salary)'}
        placeholderTextColor="#6B7280"
        style={styles.input}
      />
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Actions */}
      <View style={[styles.row, { marginTop: 8 }]}>
        {mode === 'edit' && (
          <Pressable style={[styles.btnDanger, { marginRight: 8 }]} onPress={onDelete}>
            <Text style={styles.btnText}>Delete</Text>
          </Pressable>
        )}
        <Pressable style={styles.btnSave} onPress={onSave}>
          <Text style={styles.btnText}>{mode === 'edit' ? 'Save' : 'Add'}</Text>
        </Pressable>
      </View>

      {/* Preview */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.preview}>
          {type === 'expense' ? '-' : '+'}{money(Number(amount || 0), prefs)} • {category || '—'} • {date}
        </Text>
      </View>
    </View>
  );
}

// after your Save/Delete buttons
<Pressable
  style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
  onPress={async () => {
    // assumes you have `txn` in scope (the current transaction being edited or created)
    const source = txn; // or build from your form state
    if (!source?.id) return;
    // Prefill RecurringScreen form with tx data
   navigation.navigate('Recurring', {
      preset: {
        accountId: String(txn.accountId),
        type: txn.type,
        amount: String(txn.amount),
        category: txn.category,
        note: txn.note,
      },
      focus: 'NEW',
    });

  }}
>
  <Text style={styles.btnText}>Create recurring from this</Text>
</Pressable>

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16, paddingTop: Platform.OS === 'ios' ? 44 : 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pill: { backgroundColor: '#1F2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginRight: 8 },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextActive: { color: '#fff' },
  accountBtn: { backgroundColor: '#1F2937', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
  accountBtnText: { color: '#fff', fontWeight: '700' },
  input: { backgroundColor: '#0F172A', color: '#fff', borderColor: '#1F2937', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  btn: {  paddingVertical: 12,  paddingHorizontal: 16,  borderRadius: 10,  alignItems: 'center',  justifyContent: 'center',},
  btnGhost: { backgroundColor: '#1F2937' },  // dark neutral (matches your theme)
  btnText: { color: '#fff', fontWeight: '700' },
  btnSave: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnDanger: { backgroundColor: '#7F1D1D', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#111827', borderRadius: 12, padding: 12 },
  preview: { color: '#E5E7EB', fontWeight: '700' },
  

});
