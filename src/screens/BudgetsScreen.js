// src/screens/BudgetsScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, FlatList, Alert, Platform, Switch } from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

const pad = (n) => String(n).padStart(2, '0');
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;           // YYYY-MM
const thisMonthStr = ym(new Date());
const prevMonthStr = (() => {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return ym(d);
})(); 

export default function BudgetsScreen() {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const txns = state?.transactions || [];
  const allBudgets = state?.budgets || []; // [{ id, category, limit, month? }]

  // local form
  const [category, setCategory] = useState('');
  const [limitStr, setLimitStr] = useState('');
  const [editingId, setEditingId] = useState(null);

  // ---- expenses by category for this & last month ----
  const expenseByMonthCat = useMemo(() => {
    const map = { [thisMonthStr]: {}, [prevMonthStr]: {} };
    for (const t of txns) {
      if (t.type !== 'expense') continue;
      const m = (t.date || '').slice(0, 7);
      if (m !== thisMonthStr && m !== prevMonthStr) continue;
      const cat = (t.category || 'Uncategorized').trim();
      map[m][cat] = (map[m][cat] || 0) + Number(t.amount || 0);
    }
    return map;
  }, [txns]);

  // ---- budget limits by category for this & last month ----
  const limitByMonthCat = useMemo(() => {
    const map = { [thisMonthStr]: {}, [prevMonthStr]: {} };
    for (const b of allBudgets) {
      const m = b.month || thisMonthStr;
      if (m !== thisMonthStr && m !== prevMonthStr) continue;
      const cat = (b.category || 'Uncategorized').trim();
      map[m][cat] = Number(map[m][cat] || 0) + Number(b.limit || 0);
    }
    return map;
  }, [allBudgets]);

  // ---- rows (effective limit applies rollover if enabled) ----
  const rows = useMemo(() => {
    // visible budgets: those for THIS MONTH (or global/no-month)
    const baseRows = (allBudgets || [])
      .filter(b => !b.month || b.month === thisMonthStr)
      .map(b => {
        const cat = (b.category || 'Uncategorized').trim();

        const spentThis = expenseByMonthCat[thisMonthStr][cat] || 0;
        const limitThis = Number(b.limit || 0);

        // Rollover: only last month’s leftover (per category), >= 0
        const limitLast = limitByMonthCat[prevMonthStr][cat] || 0;
        const spentLast = expenseByMonthCat[prevMonthStr][cat] || 0;
        const carry = Math.max(0, Number(limitLast) - Number(spentLast));

        const effectiveLimit = prefs.budgetRollover ? (limitThis + carry) : limitThis;
        const pct = effectiveLimit > 0 ? Math.min(1, spentThis / effectiveLimit) : 0;
        const remaining = Math.max(0, effectiveLimit - spentThis);

        return {
          ...b,
          category: cat,
          month: b.month || thisMonthStr,
          spent: spentThis,
          limitBase: limitThis,
          carry,
          effectiveLimit,
          remaining,
          pct,
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category));

    return baseRows;
  }, [allBudgets, prefs.budgetRollover, expenseByMonthCat, limitByMonthCat]);

  const totals = useMemo(() => {
    let limitBase = 0, carry = 0, effectiveLimit = 0, spent = 0;
    for (const r of rows) {
      limitBase += Number(r.limitBase || 0);
      carry += Number(r.carry || 0);
      effectiveLimit += Number(r.effectiveLimit || 0);
      spent += Number(r.spent || 0);
    }
    const pct = effectiveLimit > 0 ? Math.min(1, spent / effectiveLimit) : 0;
    return { limitBase, carry, effectiveLimit, spent, pct };
  }, [rows]);

  // ---- form helpers ----
  const resetForm = () => { setCategory(''); setLimitStr(''); setEditingId(null); };

  const addBudget = async () => {
    const cat = category.trim() || 'Uncategorized';
    const limit = Number(limitStr);
    if (!isFinite(limit) || limit <= 0) return Alert.alert('Budget', 'Enter a positive number for limit.');
    const newBudget = { id: `b_${Date.now()}`, category: cat, limit, month: thisMonthStr };
    await actions.setBudgets([...(allBudgets || []), newBudget]);
    resetForm();
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setCategory(row.category);
    setLimitStr(String(row.limitBase));
  };

  const saveEdit = async () => {
    const cat = category.trim() || 'Uncategorized';
    const limit = Number(limitStr);
    if (!isFinite(limit) || limit <= 0) return Alert.alert('Budget', 'Enter a positive number for limit.');
    const next = (allBudgets || []).map(b =>
      b.id === editingId ? { ...b, category: cat, limit } : b
    );
    await actions.setBudgets(next);
    resetForm();
  };

  const onDelete = (id) => {
    Alert.alert('Delete budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const next = (allBudgets || []).filter(b => b.id !== id);
          await actions.setBudgets(next);
        }
      }
    ]);
  };

  const toggleRollover = async (v) => {
    await actions.updatePrefs({ budgetRollover: v });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>Monthly limits per category — {thisMonthStr}</Text>

      {/* Rollover toggle */}
      <View key={r.id ?? r.category} style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Rollover unused from last month</Text>
          <Switch value={!!prefs.budgetRollover} onValueChange={toggleRollover} />
        </View>
        {prefs.budgetRollover ? (
          <Text style={styles.subtle}>
            Any leftover from {prevMonthStr} is added to this month’s limit per category.
          </Text>
        ) : (
          <Text style={styles.subtle}>
            Turn this on to carry forward unused budget from the previous month.
          </Text>
        )}
      </View>

      {/* Overall summary */}
      <View key={r.id ?? r.category} style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Base Limit</Text>
          <Text style={styles.amount}>{money(totals.limitBase, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Rollover Added</Text>
          <Text style={styles.amount}>{money(totals.carry, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Effective Limit</Text>
          <Text style={styles.amount}>{money(totals.effectiveLimit, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Spent</Text>
          <Text style={[styles.amount, styles.red]}>{money(totals.spent, prefs)}</Text>
        </View>
        <Progress value={totals.pct} />
      </View>

      {/* List */}
  <FlatList
    data={rows}
    keyExtractor={(item, index) => String(item.id ?? `${item.category}-${item.month}-${index}`)}
    contentContainerStyle={{ paddingBottom: 16 }}
    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    renderItem={({ item }) => (
      <View key={r.id ?? r.category} style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.itemLeft}>{item.category}</Text>
          <Text style={styles.amount}>{money(item.effectiveLimit, prefs)}</Text>
        </View>

            {/* breakdown */}
            <View style={styles.rowBetween}>
              <Text style={styles.subtle}>Base</Text>
              <Text style={styles.amount}>{money(item.limitBase, prefs)}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.subtle}>Rollover</Text>
              <Text style={styles.amount}>{money(item.carry, prefs)}</Text>
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
      <View key={r.id ?? r.category} style={styles.card}>
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
