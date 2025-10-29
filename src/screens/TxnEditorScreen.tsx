// src/screens/TxnEditorScreen.js
import React, { useEffect, useMemo, useState } from 'react';
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

const pad2 = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export default function TxnEditorScreen({ navigation, route }) {
  const { state, actions } = useApp();
  const accounts = state?.accounts ?? [];
  const params = route?.params || {};
  const mode = params.mode === 'edit' ? 'edit' : 'add';
  const editId = mode === 'edit' ? String(params.txnId || '') : null;

  const editingTxn = useMemo(() => {
    if (!editId) return null;
    return (state.transactions || []).find((t) => String(t.id) === editId) || null;
  }, [state.transactions, editId]);

  // Form state
  const [accountId, setAccountId] = useState(
    String(editingTxn?.accountId || params.accountId || (accounts[0]?.id ?? ''))
  );
  const [type, setType] = useState(editingTxn?.type || 'expense'); // 'expense' | 'income'
  const [amount, setAmount] = useState(
    editingTxn?.amount != null ? String(editingTxn.amount) : ''
  );
  const [date, setDate] = useState(editingTxn?.date || todayISO());
  const [category, setCategory] = useState(
    editingTxn?.category || (type === 'income' ? 'Income' : 'General')
  );
  const [note, setNote] = useState(editingTxn?.note || '');

  // If editingTxn changes (hot reload), refresh form
  useEffect(() => {
    if (editingTxn) {
      setAccountId(String(editingTxn.accountId || accounts[0]?.id || ''));
      setType(editingTxn.type || 'expense');
      setAmount(editingTxn.amount != null ? String(editingTxn.amount) : '');
      setDate(editingTxn.date || todayISO());
      setCategory(editingTxn.category || (editingTxn.type === 'income' ? 'Income' : 'General'));
      setNote(editingTxn.note || '');
    }
  }, [editingTxn, accounts]);

  const byAccount = useMemo(() => {
    const map = {};
    for (const a of accounts) map[String(a.id)] = a;
    return map;
  }, [accounts]);

  const cycleAccount = () => {
    if (!accounts.length) return;
    const ids = accounts.map((a) => String(a.id));
    const cur = accountId || ids[0];
    const idx = ids.indexOf(cur);
    const next = idx === -1 || idx === ids.length - 1 ? ids[0] : ids[idx + 1];
    setAccountId(next);
  };

  const validate = () => {
    const amt = Number(amount);
    if (!accountId) {
      Alert.alert('Account', 'Please choose an account.');
      return null;
    }
    if (!isFinite(amt) || amt <= 0) {
      Alert.alert('Amount', 'Enter a positive number.');
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Date', 'Use YYYY-MM-DD.');
      return null;
    }
    return { amt };
  };

  const onSave = async () => {
    const v = validate();
    if (!v) return;
    const payload = {
      accountId: String(accountId),
      type,
      amount: v.amt,
      date,
      category: (category || (type === 'income' ? 'Income' : 'General')).trim(),
      note: (note || '').trim(),
    };
    try {
      if (mode === 'edit' && editingTxn?.id) {
        await actions.updateTransaction({ id: String(editingTxn.id), ...payload });
      } else {
        await actions.addTransaction(payload);
      }
      navigation.goBack();
    } catch (e) {
      console.warn('[txn] save failed', e);
      Alert.alert('Save failed', 'Please try again.');
    }
  };

  const onDelete = () => {
    if (!(mode === 'edit' && editingTxn?.id)) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await actions.deleteTransaction(String(editingTxn.id));
            navigation.goBack();
          } catch (e) {
            console.warn('[txn] delete failed', e);
            Alert.alert('Delete failed', 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{mode === 'edit' ? 'Edit Transaction' : 'New Transaction'}</Text>
      <Text style={styles.subtle}>
        {mode === 'edit' ? 'Update the details below' : 'Enter the details below'}
      </Text>

      <View style={styles.card}>
        {/* Type toggle */}
        <View style={[styles.row, { marginBottom: 8 }]}>
          {['expense', 'income'].map((t) => (
            <Pressable
              key={t}
              style={[styles.pill, type === t && styles.pillActive]}
              onPress={() => {
                setType(t);
                if (!category) setCategory(t === 'income' ? 'Income' : 'General');
              }}
            >
              <Text style={[styles.pillText, type === t && styles.pillTextActive]}>
                {t[0].toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Account cycler */}
        <Pressable style={styles.accountBtn} onPress={cycleAccount}>
          <Text style={styles.accountBtnText}>
            Account: {byAccount[accountId]?.name || '—'}
          </Text>
        </Pressable>

        {/* Amount */}
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount (e.g., 19.99)"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
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
          placeholder={type === 'income' ? 'Category (e.g., Salary)' : 'Category (e.g., Groceries)'}
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
        <View style={[styles.row, { marginTop: 12 }]}>
          {mode === 'edit' && (
            <Pressable style={[styles.btn, styles.btnDanger, { marginRight: 8 }]} onPress={onDelete}>
              <Text style={styles.btnText}>Delete</Text>
            </Pressable>
          )}
          <Pressable style={[styles.btn, styles.btnSave]} onPress={onSave}>
            <Text style={styles.btnText}>{mode === 'edit' ? 'Save' : 'Add'}</Text>
          </Pressable>
        </View>

        {/* Create recurring from this (inline style to avoid style key issues) */}
        {mode === 'edit' && editingTxn?.id && (
          <Pressable
            style={{
              backgroundColor: '#1F2937',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 8,
            }}
            onPress={() => {
              const source = {
                accountId,
                type,
                amount,
                category,
                note,
              };
              navigation.navigate('Recurring', {
                preset: {
                  accountId: String(source.accountId),
                  type: source.type,
                  amount: String(source.amount),
                  category: source.category || (source.type === 'income' ? 'Income' : 'General'),
                  note: source.note || '',
                },
                focus: 'NEW',
              });
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Create recurring from this</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center' },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },

  pill: {
    backgroundColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  accountBtn: {
    backgroundColor: '#1F2937',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
  },
  accountBtnText: { color: '#fff', fontWeight: '700' },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: { backgroundColor: '#2563EB' },
  btnDanger: { backgroundColor: '#7F1D1D' },
  btnText: { color: '#fff', fontWeight: '700' },
});
