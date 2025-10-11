// src/screens/RecurringScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Switch, FlatList, Alert, Platform } from 'react-native';
import { useApp } from '../state/AppState';

const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
const todayISO = () => new Date().toISOString().slice(0,10);

export default function RecurringScreen() {
  const { state, actions } = useApp();
  const accounts = state?.accounts || [];
  const items = (state?.recurring || []).slice().sort((a,b)=> (a.category||'').localeCompare(b.category||''));

  // form
  const [editingId, setEditingId] = useState(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id || null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [freq, setFreq] = useState('monthly'); // 'daily'|'weekly'|'monthly'
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [autoPost, setAutoPost] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setAccountId(accounts[0]?.id || null);
    setType('expense');
    setAmount('');
    setCategory('');
    setNote('');
    setFreq('monthly');
    setStartDate(todayISO());
    setEndDate('');
    setAutoPost(true);
  };

  const cycleAccount = () => {
    if (!accounts.length) return;
    if (!accountId) return setAccountId(accounts[0].id);
    const ids = accounts.map(a=>a.id);
    const i = ids.indexOf(accountId);
    setAccountId(i === -1 || i === ids.length-1 ? ids[0] : ids[i+1]);
  };

  const onSave = async () => {
    const amt = Number(amount);
    if (!accountId) return Alert.alert('Account', 'Pick an account.');
    if (!isFinite(amt) || amt <= 0) return Alert.alert('Amount', 'Enter a positive amount.');
    if (!isISO(startDate)) return Alert.alert('Start Date', 'Use YYYY-MM-DD format.');
    if (endDate && !isISO(endDate)) return Alert.alert('End Date', 'Use YYYY-MM-DD or leave blank.');

    const payload = {
      id: editingId || undefined,
      accountId,
      type,
      amount: amt,
      category: category.trim() || (type==='expense' ? 'General' : 'Income'),
      note: note.trim(),
      freq,
      startDate,
      endDate: endDate || undefined,
      autoPost: !!autoPost,
    };

    if (editingId) {
      await actions.updateRecurring(payload);
    } else {
      await actions.addRecurring(payload);
    }
    resetForm();
  };

  const onEdit = (r) => {
    setEditingId(r.id);
    setAccountId(r.accountId);
    setType(r.type);
    setAmount(String(r.amount));
    setCategory(r.category || '');
    setNote(r.note || '');
    setFreq(r.freq || 'monthly');
    setStartDate(r.startDate || todayISO());
    setEndDate(r.endDate || '');
    setAutoPost(!!r.autoPost);
  };

  const onDelete = (id) => {
    Alert.alert('Delete schedule?', 'This will not remove already posted transactions.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteRecurring(id) },
    ]);
  };

  const accountName = useMemo(
    () => accounts.find(a=>a.id===accountId)?.name || '—',
    [accounts, accountId]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Recurring</Text>
      <Text style={styles.subtle}>Auto-post transactions on a schedule</Text>

      {/* List */}
      <FlatList
        data={accountTxns}
        keyExtractor={(item, index) => String(item.id ?? `${item.accountId}-${item.date}-${index}`)}
        contentContainerStyle={{ paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={<View style={{ height: 12 }} />}
        renderItem={({ item: r }) => (
          <View key={r.id ?? r.category} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemLeft}>{r.category} • {r.freq}</Text>
              <Text style={styles.itemRight}>
                {r.type === 'expense' ? '-' : '+'}{Number(r.amount).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.subtle}>
              {accounts.find(a=>a.id===r.accountId)?.name || 'Account'} •
              {' '}from {r.startDate}{r.endDate ? ` to ${r.endDate}` : ''}{r.autoPost ? ' • auto' : ''}
            </Text>

            <View style={styles.row}>
              <Pressable style={[styles.btnTiny, { marginRight: 8 }]} onPress={() => onEdit(r)}>
                <Text style={styles.btnTinyText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.btnTinyDanger} onPress={() => onDelete(r.id)}>
                <Text style={styles.btnTinyText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.subtle, { paddingHorizontal: 16 }]}>No schedules yet.</Text>}
      />

      {/* Form */}
      <View key={r.id ?? r.category} style={styles.card}>
        <Text style={styles.label}>{editingId ? 'Edit schedule' : 'Add schedule'}</Text>

        <Pressable style={styles.accountBtn} onPress={cycleAccount}>
          <Text style={styles.accountBtnText}>Account: {accountName}</Text>
        </Pressable>

        <View style={styles.row}>
          <Pressable style={[styles.pill, type==='expense' && styles.pillActive]} onPress={()=>setType('expense')}>
            <Text style={[styles.pillText, type==='expense' && styles.pillTextActive]}>Expense</Text>
          </Pressable>
          <Pressable style={[styles.pill, type==='income' && styles.pillActive]} onPress={()=>setType('income')}>
            <Text style={[styles.pillText, type==='income' && styles.pillTextActive]}>Income</Text>
          </Pressable>
        </View>

        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Amount (e.g., 25.00)"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />

        <View style={styles.row}>
          <Pressable style={[styles.pill, freq==='monthly' && styles.pillActive]} onPress={()=>setFreq('monthly')}>
            <Text style={[styles.pillText, freq==='monthly' && styles.pillTextActive]}>Monthly</Text>
          </Pressable>
          <Pressable style={[styles.pill, freq==='weekly' && styles.pillActive]} onPress={()=>setFreq('weekly')}>
            <Text style={[styles.pillText, freq==='weekly' && styles.pillTextActive]}>Weekly</Text>
          </Pressable>
          <Pressable style={[styles.pill, freq==='daily' && styles.pillActive]} onPress={()=>setFreq('daily')}>
            <Text style={[styles.pillText, freq==='daily' && styles.pillTextActive]}>Daily</Text>
          </Pressable>
        </View>

        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder={type==='expense' ? 'Category (e.g., Rent)' : 'Category (e.g., Salary)'}
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

        <View style={styles.row}>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Start YYYY-MM-DD"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="End YYYY-MM-DD (optional)"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1 }]}
          />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Auto-post</Text>
          <Switch value={!!autoPost} onValueChange={setAutoPost} />
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btnSave, { marginRight: 8 }]} onPress={onSave}>
            <Text style={styles.btnText}>{editingId ? 'Save' : 'Add'}</Text>
          </Pressable>
          <Pressable style={styles.btnCancel} onPress={resetForm}>
            <Text style={styles.btnText}>Clear</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16, paddingTop: Platform.OS === 'ios' ? 44 : 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },

  label: { color: '#E5E7EB', fontWeight: '700' },

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
  btnTiny: { backgroundColor: '#1F2937', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  btnTinyDanger: { backgroundColor: '#7F1D1D', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  btnTinyText: { color: '#fff', fontWeight: '700' },

  itemLeft: { color: '#E5E7EB', fontWeight: '700' },
  itemRight: { color: '#E5E7EB', fontWeight: '800' },
});
