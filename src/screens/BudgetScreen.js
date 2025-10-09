// src/screens/BudgetsScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, Alert, Platform } from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const THIS_MONTH = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`; // YYYY-MM

export default function BudgetsScreen() {
  const { state, actions, selectors } = useApp();
  const prefs = state?.prefs || {};
  const txns = state?.transactions || [];
  const budgets = state?.budgets || []; // [{ id, category, limit, month? }]

  // form
  const [category, setCategory] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Sum this month’s expense by category
  const monthExpenseByCategory = useMemo(() => {
    const map = {};
    const thisMonth = THIS_MONTH;
    for (const t of txns) {
      if (t.type !== 'expense') continue;
      if (!t.date || !t.date.startsWith(thisMonth)) continue;
      const cat = (t.category || 'Uncategorized').trim();
      map[cat] = (map[cat] || 0) + Number(t.amount || 0);
    }
    return map;
  }, [txns]);

  const rows = useMemo(() => {
    // use only budgets for THIS_MONTH (or global ones without month set)
    return budgets
      .filter(b => !b.month || b.month === THIS_MONTH)
      .map(b => {
        const spent = monthExpenseByCategory[b.category] || 0;
        const limit = Number(b.limit || 0);
        const pct = limit > 0 ? Math.min(1, spent / limit) : 0;
        const remaining = Math.max(0, limit - spent);
        return { ...b, spent, remaining, pct };
      })
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [budgets, monthExpenseByCategory]);

  const resetForm = () => { setCategory(''); setLimitStr(''); setEditingId(null); };

  const addBudget = async () => {
    const cat = category.trim() || 'Uncategorized';
    const limit = Number(limitStr);
    if (!isFinite(limit) || limit <= 0) return Alert.alert('Budget', 'Enter a positive number for limit.');
    const newBudget = { id: `b_${Date.now()}`, category: cat, limit, month: THIS_MONTH };
    await actions.setBudgets([...(state.budgets || []), newBudget]);
    resetForm();
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setCategory(row.category);
    setLimitStr(String(row.limit));
  };

  const saveEdit = async () => {
    const cat = category.trim() || 'Uncategorized';
    const limit = Number(limitStr);
    if (!isFinite(limit) || limit <= 0) return Alert.alert('Budget', 'Enter a positive number for limit.');
    const next = (state.budgets || []).map(b => (b.id === editingId ? { ...b, category: cat, limit } : b));
    await actions.setBudgets(next);
    resetForm();
  };

  const onDelete = (id) => {
    Alert.alert('Delete budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const next = (state.budgets || []).filter(b => b.id !== id);
          await actions.setBudgets(next);
        }
      }
    ]);
  };

  const totalLimit = rows.reduce((s, r) => s + Number(r.limit || 0), 0);
  const totalSpent = rows.reduce((s, r) => s + Number(r.spent || 0), 0);
  const totalPct = totalLimit > 0 ? Math.min(1, totalSpent / totalLimit) : 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>Monthly limits per category — {THIS_MONTH}</Text>

      {/* Overall summary */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total Limit</Text>
          <Text style={styles.amount}>{money(totalLimit, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Total Spent</Text>
          <Text style={[styles.amount, styles.red]}>{money(totalSpent, prefs)}</Text>
        </View>
        <Progress value={totalPct} />
      </View>

      {/* List */}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemLeft}>{item.category}</Text>
              <Text style={styles.amount}>{money(item.limit, prefs)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.subtle}>Spent</Text>
              <Text style={[styles.amount, styles.red]}>{money(item.spent, prefs)}</Text>
            </View>
            <Progress value={item.pct} />
            <View style={styles.rowBetween}>
              <Text style={styles.subtle}>Remaining</Text>
              <Text style={[styles.amount, item.remaining <= 0 ? styles.red : styles.green]}>
                {money(item.remaining, prefs)}
              </Text>
            </View>

            <View style={styles.row}>
              <Pressable style={[styles.btnTiny, { marginRight: 8 }]} onPress={() => startEdit(item)}>
                <Text style={styles.btnTinyText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.btnTinyDanger} onPress={() => onDelete(item.id)}>
                <Text style={styles.btnTinyText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.subtle, { padding: 16 }]}>No budgets yet.</Text>}
      />

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.label}>{editingId ? 'Edit budget' : 'Add budget'}</Text>
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="Category (e.g., Groceries)"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />
        <TextInput
          value={limitStr}
          onChangeText={setLimitStr}
          placeholder="Limit (e.g., 250)"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <View style={styles.row}>
          {editingId ? (
            <>
              <Pressable style={[styles.btnSave, { marginRight: 8 }]} onPress={saveEdit}>
                <Text style={styles.btnText}>Save</Text>
              </Pressable>
              <Pressable style={styles.btnCancel} onPress={resetForm}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.btnSave} onPress={addBudget}>
              <Text style={styles.btnText}>Add Budget</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Progress({ value }) {
  const pct = Math.max(0, Math.min(1, Number(value || 0)));
  return (
    <View style={styles.barWrap}>
      <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
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

  itemLeft: { color: '#E5E7EB', fontWeight: '700' },
  label: { color: '#E5E7EB', fontWeight: '700' },
  amount: { color: '#E5E7EB', fontWeight: '800' },
  red: { color: '#DC2626' },
  green: { color: '#34D399' },

  input: {
    backgroundColor: '#0F172A', color: '#fff', borderColor: '#1F2937',
    borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8,
  },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnCancel: { backgroundColor: '#6B7280', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },

  btnTiny: { backgroundColor: '#1F2937', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  btnTinyDanger: { backgroundColor: '#7F1D1D', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  btnTinyText: { color: '#fff', fontWeight: '700' },

  barWrap: {
    height: 10, backgroundColor: '#1F2937', borderRadius: 6,
    overflow: 'hidden', marginTop: 8,
  },
  barFill: { height: 10, backgroundColor: '#2563EB' },
});
