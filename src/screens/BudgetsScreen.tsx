// src/screens/BudgetsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useApp } from '../state/AppContext';
import type { RootStackParamList } from '../navigations/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // matches 'YYYY-MM'
}

function money(n: number) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  } catch {
    return `£${n.toFixed(2)}`;
  }
}

export default function BudgetsScreen({ navigation }: Props) {
  const { state, actions } = useApp();
  const budgets = state.budgets || [];
  const txs = state.transactions || [];

  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const thisMonth = monthKey();

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};

    for (const t of txs) {
      // budget only tracks expenses
      if (t.type !== 'expense') continue;
      if (!t.date || !t.date.startsWith(thisMonth)) continue;

      const cat = (t.category || 'Uncategorised').trim();
      map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
    }

    return map;
  }, [txs, thisMonth]);

  const derived = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = spentByCategory[b.category] || 0;
        const limit = Number(b.limit) || 0;
        const remaining = limit - spent;
        const pct = limit > 0 ? Math.min(1, spent / limit) : 0;

        const status =
          limit <= 0 ? 'unset' :
          spent >= limit ? 'exceeded' :
          spent >= limit * 0.8 ? 'warning' :
          'ok';

        return { ...b, spent, remaining, pct, status };
      })
      .sort((a, b) => {
        // exceeded first, then warning, then ok, then unset
        const rank = (s: string) =>
          s === 'exceeded' ? 0 : s === 'warning' ? 1 : s === 'ok' ? 2 : 3;
        return rank(a.status) - rank(b.status) || a.category.localeCompare(b.category);
      });
  }, [budgets, spentByCategory]);

  const handleAdd = () => {
    const cat = newCategory.trim();
    const limit = Number(newLimit);

    if (!cat) return;

    if (!Number.isFinite(limit) || limit <= 0) {
      Alert.alert('Invalid limit', 'Enter a monthly limit greater than 0.');
      return;
    }

    // prevent duplicates (same category)
    const exists = budgets.some((b) => b.category.toLowerCase() === cat.toLowerCase());
    if (exists) {
      Alert.alert('Already exists', 'You already have a budget for that category.');
      return;
    }

    actions.addBudget({ category: cat, limit });
    setNewCategory('');
    setNewLimit('');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => actions.deleteBudget(id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>Budgets</Text>
        <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.subtle}>Tracking month: {thisMonth}</Text>

      {/* Add budget */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add budget</Text>

        <Text style={styles.label}>Category</Text>
        <TextInput
          value={newCategory}
          onChangeText={setNewCategory}
          placeholder="e.g. Groceries"
          placeholderTextColor="#7a7a7a"
          style={styles.input}
        />

        <Text style={styles.label}>Monthly limit</Text>
        <TextInput
          value={newLimit}
          onChangeText={setNewLimit}
          placeholder="e.g. 300"
          placeholderTextColor="#7a7a7a"
          keyboardType="numeric"
          style={styles.input}
        />

        <Pressable style={[styles.btn, { marginTop: 10 }]} onPress={handleAdd}>
          <Text style={styles.btnText}>Add budget</Text>
        </Pressable>
      </View>

      {/* Budget list */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your budgets</Text>

        {derived.length === 0 ? (
          <Text style={styles.subtle}>No budgets yet. Add one above.</Text>
        ) : (
          derived.map((b) => {
            const statusText =
              b.status === 'exceeded'
                ? 'Exceeded'
                : b.status === 'warning'
                ? 'Near limit'
                : b.status === 'ok'
                ? 'On track'
                : 'No limit';

            return (
              <View key={b.id} style={styles.budgetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetTitle}>{b.category}</Text>

                  <View style={styles.kpiRow}>
                    <Text style={styles.kpi}>Limit: {money(b.limit)}</Text>
                    <Text style={styles.kpi}>Spent: {money(b.spent)}</Text>
                    <Text style={styles.kpi}>
                      Remaining: {money(Math.max(-999999999, b.remaining))}
                    </Text>
                  </View>

                  <View style={styles.progressOuter}>
                    <View style={[styles.progressInner, { width: `${Math.round(b.pct * 100)}%` }]} />
                  </View>

                  <Text style={styles.status}>Status: {statusText}</Text>

                  <Text style={[styles.label, { marginTop: 8 }]}>Edit monthly limit</Text>
                  <View style={styles.inlineRow}>
                    <TextInput
                      defaultValue={String(b.limit)}
                      keyboardType="numeric"
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      onSubmitEditing={(e) => {
                        const n = Number(e.nativeEvent.text);
                        if (!Number.isFinite(n) || n <= 0) return;
                        actions.updateBudget(b.id, { limit: n });
                      }}
                    />
                    <Pressable style={[styles.btnSecondary, { marginLeft: 10 }]} onPress={() => handleDelete(b.id)}>
                      <Text style={styles.btnSecondaryText}>Delete</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.help}>
                    Tip: press “Enter” after changing the limit to save.
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#0B1020',
    flexGrow: 1,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  h1: { fontSize: 26, fontWeight: '800', color: '#E5E7EB' },
  subtle: { marginTop: 6, color: '#9CA3AF' },

  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    color: '#E5E7EB',
  },

  label: { marginTop: 10, marginBottom: 6, color: '#E5E7EB' },

  input: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    color: '#E5E7EB',
    backgroundColor: '#0B1020',
  },

  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1020',
    alignSelf: 'flex-start',
  },
  btnText: { fontWeight: '700', color: '#E5E7EB' },

  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
    alignSelf: 'flex-start',
  },
  btnSecondaryText: { fontWeight: '700', color: '#E5E7EB' },

  budgetRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },

  budgetTitle: { fontSize: 16, fontWeight: '800', color: '#E5E7EB' },

  kpiRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  kpi: { color: '#9CA3AF' },

  progressOuter: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  progressInner: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4B5563',
  },

  status: { marginTop: 8, fontWeight: '700', color: '#E5E7EB' },

  inlineRow: { flexDirection: 'row', alignItems: 'center' },

  help: { marginTop: 6, fontSize: 12, color: '#9CA3AF' },
});

