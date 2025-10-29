// src/screens/RecurringScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppState';

const pad2 = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const FREQS = ['daily', 'weekly', 'monthly'];

export default function RecurringScreen({ navigation, route }) {
  const { state, actions } = useApp();
  const accounts = state?.accounts ?? [];
  const items = state?.recurring ?? [];

  // Optional preset passed via navigation
  const preset = route?.params?.preset || null;
  const autoFocusNew = route?.params?.focus === 'NEW';

  const [editingId, setEditingId] = useState(null); // null | 'NEW' | existing id
  const [form, setForm] = useState({
    accountId: accounts[0] ? String(accounts[0].id) : '',
    type: 'expense',       // 'expense' | 'income'
    amount: '',
    category: '',
    note: '',
    freq: 'monthly',       // 'daily' | 'weekly' | 'monthly'
    startDate: todayISO(),
    endDate: '',
    autoPost: true,
  });

  // If caller asked to jump straight into NEW with a preset, do it once
  useEffect(() => {
    if (autoFocusNew) {
      startNew(preset || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusNew]);

  const byAccount = useMemo(() => {
    const m = {};
    for (const a of accounts) m[String(a.id)] = a;
    return m;
  }, [accounts]);

  const startNew = (seed) => {
    setEditingId('NEW');
    setForm({
      accountId: seed?.accountId || (accounts[0] ? String(accounts[0].id) : ''),
      type: seed?.type || 'expense',
      amount: seed?.amount || '',
      category: seed?.category || (seed?.type === 'income' ? 'Income' : ''),
      note: seed?.note || '',
      freq: 'monthly',
      startDate: todayISO(),
      endDate: '',
      autoPost: true,
    });
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      accountId: String(item.accountId || ''),
      type: item.type || 'expense',
      amount: String(item.amount ?? ''),
      category: item.category || '',
      note: item.note || '',
      freq: item.freq || 'monthly',
      startDate: item.startDate || todayISO(),
      endDate: item.endDate || '',
      autoPost: !!item.autoPost,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const cycleAccount = () => {
    if (!accounts.length) return;
    const ids = accounts.map((a) => String(a.id));
    const cur = form.accountId ? String(form.accountId) : ids[0];
    const idx = ids.indexOf(cur);
    const next = idx === -1 || idx === ids.length - 1 ? ids[0] : ids[idx + 1];
    setForm((f) => ({ ...f, accountId: next }));
  };

  const saveItem = async () => {
    const amt = Number(form.amount);
    if (!form.accountId) return Alert.alert('Account', 'Choose an account.');
    if (!isFinite(amt) || amt <= 0) return Alert.alert('Amount', 'Enter a positive number.');
    if (!FREQS.includes(form.freq)) return Alert.alert('Frequency', 'Pick daily, weekly, or monthly.');
    if (form.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.startDate))
      return Alert.alert('Start date', 'Use YYYY-MM-DD.');
    if (form.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate))
      return Alert.alert('End date', 'Use YYYY-MM-DD.');

    const payload = {
      accountId: String(form.accountId),
      type: form.type,
      amount: amt,
      category: form.category?.trim(),
      note: form.note?.trim(),
      freq: form.freq,
      startDate: form.startDate || todayISO(),
      endDate: form.endDate?.trim() || undefined,
      autoPost: !!form.autoPost,
    };

    try {
      if (editingId && editingId !== 'NEW') {
        await actions.updateRecurring({ id: editingId, ...payload });
      } else {
        await actions.addRecurring(payload);
      }
      setEditingId(null);
    } catch (e) {
      console.warn('[recurring] save failed', e);
      Alert.alert('Save failed', 'Please try again.');
    }
  };

  const deleteItem = (id) => {
    Alert.alert('Delete schedule?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await actions.deleteRecurring(id);
          if (editingId === id) setEditingId(null);
        },
      },
    ]);
  };

  const Header = () => (
    <View style={styles.header}>
      <Text style={styles.h1}>Recurring</Text>
      <Text style={styles.subtle}>Create rules that auto-post on a schedule.</Text>
    </View>
  );

  const Editor = () => (
    <View style={styles.card}>
      <Text style={styles.rowTitle}>{editingId === 'NEW' ? 'New Schedule' : 'Edit Schedule'}</Text>

      {/* Type */}
      <View style={[styles.row, { marginBottom: 8 }]}>
        {['expense', 'income'].map((t) => (
          <Pressable
            key={t}
            style={[styles.pill, form.type === t && styles.pillActive]}
            onPress={() =>
              setForm((f) => ({
                ...f,
                type: t,
                category: f.category || (t === 'expense' ? 'General' : 'Income'),
              }))
            }
          >
            <Text style={[styles.pillText, form.type === t && styles.pillTextActive]}>
              {t[0].toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Account cycler */}
      <Pressable style={styles.accountBtn} onPress={cycleAccount}>
        <Text style={styles.accountBtnText}>
          Account: {byAccount[form.accountId]?.name || '—'}
        </Text>
      </Pressable>

      {/* Amount, Category, Note */}
      <TextInput
        value={form.amount}
        onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
        placeholder="Amount (e.g., 29.99)"
        placeholderTextColor="#6B7280"
        keyboardType="decimal-pad"
        style={styles.input}
      />
      <TextInput
        value={form.category}
        onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
        placeholder={form.type === 'expense' ? 'Category (e.g., Groceries)' : 'Category (e.g., Salary)'}
        placeholderTextColor="#6B7280"
        style={styles.input}
      />
      <TextInput
        value={form.note}
        onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
        placeholder="Note (optional)"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Frequency */}
      <View style={[styles.row, { marginTop: 6 }]}>
        {FREQS.map((f) => (
          <Pressable
            key={f}
            style={[styles.pillSm, form.freq === f && styles.pillActive]}
            onPress={() => setForm((x) => ({ ...x, freq: f }))}
          >
            <Text style={[styles.pillTextSm, form.freq === f && styles.pillTextActive]}>
              {f[0].toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Dates */}
      <View style={[styles.row, { marginTop: 8 }]}>
        <TextInput
          value={form.startDate}
          onChangeText={(v) => setForm((f) => ({ ...f, startDate: v }))}
          placeholder="Start YYYY-MM-DD"
          placeholderTextColor="#6B7280"
          style={[styles.input, { flex: 1, marginRight: 8 }]}
        />
        <TextInput
          value={form.endDate}
          onChangeText={(v) => setForm((f) => ({ ...f, endDate: v }))}
          placeholder="End YYYY-MM-DD (optional)"
          placeholderTextColor="#6B7280"
          style={[styles.input, { flex: 1 }]}
        />
      </View>

      {/* Auto-post */}
      <View style={[styles.rowBetween, { marginTop: 10 }]}>
        <Text style={styles.label}>Auto-post on schedule</Text>
        <Switch
          value={!!form.autoPost}
          onValueChange={(v) => setForm((f) => ({ ...f, autoPost: v }))}
          trackColor={{ false: '#374151', true: '#2563EB' }}
          thumbColor="#fff"
        />
      </View>

      {/* Actions */}
      <View style={[styles.row, { marginTop: 12 }]}>
        <Pressable style={[styles.btn, styles.btnGhost, { marginRight: 8 }]} onPress={cancelEdit}>
          <Text style={styles.btnText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnSave]} onPress={saveItem}>
          <Text style={styles.btnText}>{editingId === 'NEW' ? 'Add' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const Row = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.itemLeft}>
          {(item.category || (item.type === 'expense' ? 'General' : 'Income'))} • {item.freq}
        </Text>
        <Text style={styles.itemRight}>
          {item.type === 'expense' ? '-' : '+'}
          {Number(item.amount).toFixed(2)}
        </Text>
      </View>
      <Text style={styles.subtle}>
        {(byAccount[String(item.accountId)]?.name || 'Account')}
        {' • '}
        from {item.startDate || '—'}
        {item.endDate ? ` to ${item.endDate}` : ''}
        {item.autoPost ? ' • auto' : ''}
      </Text>

      <View style={[styles.row, { marginTop: 8 }]} >
        <Pressable style={[styles.btnTiny, { marginRight: 8 }]} onPress={() => startEdit(item)}>
          <Text style={styles.btnTinyText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.btnTinyDanger} onPress={() => deleteItem(item.id)}>
          <Text style={styles.btnTinyText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Header />

      {/* Add new / use preset */}
      {editingId === 'NEW' ? (
        <Editor />
      ) : (
        <Pressable
          style={[styles.btn, styles.btnSave]}
          onPress={() => startNew(preset || undefined)}
        >
          <Text style={styles.btnText}>
            {preset ? 'Add from preset' : 'Add Schedule'}
          </Text>
        </Pressable>
      )}

      {/* Active editor for an existing row */}
      {editingId && editingId !== 'NEW' && <Editor />}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={[styles.subtle, { padding: 16 }]}>
            No schedules yet. Tap “{preset ? 'Add from preset' : 'Add Schedule'}” to create one.
          </Text>
        }
        renderItem={({ item }) => <Row item={item} />}
      />
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
  header: { marginBottom: 4 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },
  label: { color: '#E5E7EB', fontWeight: '800' },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

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
  pillSm: {
    backgroundColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextSm: { color: '#E5E7EB', fontWeight: '700', fontSize: 12 },
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
  btnGhost: { backgroundColor: '#1F2937' },
  btnText: { color: '#fff', fontWeight: '700' },

  btnTiny: {
    backgroundColor: '#374151',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnTinyDanger: {
    backgroundColor: '#7F1D1D',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnTinyText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  rowTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  itemLeft: { color: '#E5E7EB', fontWeight: '800' },
  itemRight: { color: '#E5E7EB', fontWeight: '800' },
});
