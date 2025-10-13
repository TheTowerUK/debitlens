// src/screens/BudgetsScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

// --- date helpers ---
const pad2 = (n) => String(n).padStart(2, '0');
const thisYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; // YYYY-MM
};
const shiftYM = (ym, delta) => {
  // ym: "YYYY-MM"
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

// --- spent calculator for a month & category ---
function spentForMonth(txns, category, ym) {
  const cat = (category || 'Uncategorized').trim();
  let sum = 0;
  for (const t of txns || []) {
    if (t.type !== 'expense') continue;
    if (!t.date || !t.date.startsWith(ym)) continue; // YYYY-MM
    const c = (t.category || 'Uncategorized').trim();
    if (c === cat) sum += Number(t.amount || 0);
  }
  return sum;
}

export default function BudgetsScreen() {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const allBudgets = state?.budgets ?? [];
  const txns = state?.transactions ?? [];

  // UI state
  const [ym, setYm] = useState(thisYM()); // which month we're viewing
  const [editingId, setEditingId] = useState(null); // budget.id being edited or null
  const [form, setForm] = useState({ category: '', limit: '', month: thisYM() });

  // Filter budgets for selected month (monthless treated as selected month if you want; here we use exact match)
  const budgets = useMemo(() => {
    return allBudgets
      .filter((b) => (b.month || thisYM()) === ym)
      .sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  }, [allBudgets, ym]);

  // Totals across this month
  const totals = useMemo(() => {
    let limitSum = 0;
    let spentSum = 0;
    for (const b of budgets) {
      const lim = Number(b.limit || 0);
      limitSum += lim;
      spentSum += spentForMonth(txns, b.category, ym);
    }
    return { limitSum, spentSum, remaining: limitSum - spentSum };
  }, [budgets, txns, ym]);

  // Start editing an existing budget row
  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      category: item.category || '',
      limit: String(item.limit ?? ''),
      month: item.month || ym,
    });
  };

  // New budget form
  const startNew = () => {
    setEditingId('NEW');
    setForm({ category: '', limit: '', month: ym });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ category: '', limit: '', month: ym });
  };

  const saveBudget = async () => {
    const category = form.category.trim();
    const limit = Number(form.limit);
    const month = (form.month || ym).trim();

    if (!category) return Alert.alert('Category', 'Please enter a category.');
    if (!isFinite(limit) || limit < 0) return Alert.alert('Limit', 'Enter a non-negative number.');
    if (!/^\d{4}-\d{2}$/.test(month)) return Alert.alert('Month', 'Use YYYY-MM (e.g., 2025-10).');

    try {
      if (editingId && editingId !== 'NEW') {
        await actions.upsertBudget({ id: editingId, category, limit, month });
      } else {
        await actions.upsertBudget({ category, limit, month });
      }
      setEditingId(null);
      setForm({ category: '', limit: '', month: ym });
    } catch (e) {
      console.warn('[budgets] save failed', e);
      Alert.alert('Save failed', 'Please try again.');
    }
  };

  const deleteBudget = (id) => {
    Alert.alert('Delete this budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await actions.deleteBudget(id);
          if (editingId === id) cancelEdit();
        } },
    ]);
  };

  const renderRow = ({ item }) => {
    const isEditing = editingId === item.id;
    const spent = spentForMonth(txns, item.category, ym);
    const remaining = Number(item.limit || 0) - spent;
    const over = remaining < 0;

    if (isEditing) {
      return (
        <View style={styles.card}>
          <Text style={styles.rowTitle}>Edit Budget</Text>
          <TextInput
            value={form.category}
            onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
            placeholder="Category"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
          <TextInput
            value={form.limit}
            onChangeText={(v) => setForm((f) => ({ ...f, limit: v }))}
            placeholder="Limit (e.g., 250)"
            placeholderTextColor="#6B7280"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <TextInput
            value={form.month}
            onChangeText={(v) => setForm((f) => ({ ...f, month: v }))}
            placeholder="Month YYYY-MM"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={cancelEdit}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSave]} onPress={saveBudget}>
              <Text style={styles.btnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.itemTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.category}
        </Text>
        <Text style={styles.itemRight}>
          {money(Number(item.limit || 0), prefs)}
        </Text>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.subtle} numberOfLines={1} ellipsizeMode="tail">
          {ym} • Spent
        </Text>
        <Text style={[styles.bold, over ? styles.red : styles.green]}>
          {money(spent, prefs)}
        </Text>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.subtle}>Remaining</Text>
        <Text style={[styles.bold, over ? styles.red : styles.green]}>
          {money(Math.abs(remaining), prefs)} {over ? 'over' : 'left'}
        </Text>
      </View>

      <View style={styles.rowWrap}>
        <Pressable style={[styles.btnTiny, { marginRight: 8 }]} onPress={() => startEdit(item)}>
          <Text style={styles.btnTinyText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.btnTinyDanger} onPress={() => deleteBudget(item.id)}>
          <Text style={styles.btnTinyText}>Delete</Text>
        </Pressable>
      </View>
    </View>

    );
  };

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>Track limits and spending per category</Text>

      {/* Month selector */}
      <View style={[styles.card, { paddingBottom: 12 }]}>
        <View style={styles.rowBetween}>
          <Pressable
            style={[styles.pill, { paddingHorizontal: 12 }]}
            onPress={() => setYm((cur) => shiftYM(cur, -1))}
          >
            <Text style={styles.pillText}>{'←'} Prev</Text>
          </Pressable>
          <Text style={styles.monthText}>{ym}</Text>
          <Pressable
            style={[styles.pill, { paddingHorizontal: 12 }]}
            onPress={() => setYm((cur) => shiftYM(cur, +1))}
          >
            <Text style={styles.pillText}>Next {'→'}</Text>
          </Pressable>
        </View>

        {/* Totals */}
        <View style={[styles.rowBetween, { marginTop: 12 }]}>
          <Text style={styles.subtle}>Total Limit</Text>
          <Text style={styles.bold}>{money(totals.limitSum, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.subtle}>Total Spent</Text>
          <Text style={[styles.bold, totals.remaining < 0 ? styles.red : styles.green]}>
            {money(totals.spentSum, prefs)}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.subtle}>Remaining</Text>
          <Text style={[styles.bold, totals.remaining < 0 ? styles.red : styles.green]}>
            {money(Math.abs(totals.remaining), prefs)} {totals.remaining < 0 ? 'over' : 'left'}
          </Text>
        </View>
      </View>

      {/* Add / New budget */}
      {editingId === 'NEW' ? (
        <View style={styles.card}>
          <Text style={styles.rowTitle}>New Budget</Text>
          <TextInput
            value={form.category}
            onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
            placeholder="Category"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
          <TextInput
            value={form.limit}
            onChangeText={(v) => setForm((f) => ({ ...f, limit: v }))}
            placeholder="Limit (e.g., 250)"
            placeholderTextColor="#6B7280"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <TextInput
            value={form.month}
            onChangeText={(v) => setForm((f) => ({ ...f, month: v }))}
            placeholder="Month YYYY-MM"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={cancelEdit}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSave]} onPress={saveBudget}>
              <Text style={styles.btnText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={[styles.btn, styles.btnSave]} onPress={startNew}>
          <Text style={styles.btnText}>Add Budget</Text>
        </Pressable>
      )}

      {/* List */}
      <FlatList
        data={budgets}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <Text style={[styles.subtle, { padding: 16 }]}>
            No budgets for {ym}. Add one above.
          </Text>
        }
        renderItem={renderRow}
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
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  monthText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },
  bold: { color: '#E5E7EB', fontWeight: '800' },

  // Cards / rows
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Inputs / buttons
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
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  pillText: { color: '#fff', fontWeight: '700' },

  itemTitle: { color: '#E5E7EB', fontWeight: '800', fontSize: 16 },
  itemRight: { color: '#E5E7EB', fontWeight: '800' },
  red: { color: '#F87171' },
  green: { color: '#34D399' },

  // Buttons
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: '#1F2937' },
  btnText: { color: '#fff', fontWeight: '700' },

  // Row controls
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
});
