// src/screens/BudgetsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { useApp, type Budget, type Transaction } from '../state/AppContext';

type EditingState =
  | { mode: 'none' }
  | { mode: 'new' }
  | { mode: 'edit'; budget: Budget };

const BudgetsScreen: React.FC = () => {
  const { state, actions } = useApp();
  const budgets = state.budgets || [];
  const txs: Transaction[] = state.transactions || [];

  const [editing, setEditing] = useState<EditingState>({ mode: 'none' });

  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');

  // Derive distinct categories from transactions
  const categories = useMemo(() => {
    const set = new Set<string>();
    txs.forEach((t) => {
      if (t.category) {
        set.add(t.category);
      }
    });
    return Array.from(set).sort();
  }, [txs]);

  // Current month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Helper: get amount spent this month for a given budget
  const getMonthlySpent = (budget: Budget): number => {
    return txs.reduce((sum, t) => {
      if (t.type !== 'expense') return sum;
      if (!t.date) return sum;

      const d = new Date(t.date);
      if (isNaN(d.getTime())) return sum;

      if (d < monthStart || d >= monthEnd) return sum;

      // Budget with category: match category
      if (budget.category && t.category !== budget.category) return sum;

      // Budget with no category: treat as "all expenses"
      return sum + (Number(t.amount) || 0);
    }, 0);
  };

  const enrichedBudgets = useMemo(
    () =>
      budgets.map((b) => {
        const spent = getMonthlySpent(b);
        const remaining = b.amount - spent;
        const pct =
          b.amount > 0
            ? Math.min(100, Math.max(0, (spent / b.amount) * 100))
            : 0;

        return {
          ...b,
          spent,
          remaining,
          pct,
        };
      }),
    [budgets, txs]
  );

  const openNewBudget = () => {
    setEditing({ mode: 'new' });
    setFormTitle('');
    setFormAmount('');
    setFormCategory('');
  };

  const openEditBudget = (b: Budget) => {
    setEditing({ mode: 'edit', budget: b });
    setFormTitle(b.title);
    setFormAmount(String(b.amount));
    setFormCategory(b.category ?? '');
  };

  const closeEditor = () => {
    setEditing({ mode: 'none' });
    setFormTitle('');
    setFormAmount('');
    setFormCategory('');
  };

  const handleSave = () => {
    const cleanTitle = formTitle.trim();
    const numericAmount = Number(formAmount);

    if (!cleanTitle) {
      Alert.alert('Missing title', 'Please enter a name for this budget.');
      return;
    }

    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Please enter a budget amount greater than 0.'
      );
      return;
    }

    const cleanCategory = formCategory.trim();
    const categoryValue = cleanCategory ? cleanCategory : null;

    if (editing.mode === 'edit') {
      actions.updateBudget(editing.budget.id, {
        title: cleanTitle,
        amount: numericAmount,
        category: categoryValue,
      });
    } else {
      actions.addBudget({
        title: cleanTitle,
        amount: numericAmount,
        category: categoryValue,
        period: 'monthly',
      });
    }

    closeEditor();
  };

  const handleDelete = (b: Budget) => {
    Alert.alert('Delete budget', `Delete "${b.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => actions.deleteBudget(b.id),
      },
    ]);
  };

  const monthLabel = (() => {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  })();

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>
        Monthly budgets by category. Current period: {monthLabel}
      </Text>

      {enrichedBudgets.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No budgets yet</Text>
          <Text style={styles.emptyText}>
            Create a budget to track how much you plan to spend this month.
          </Text>
        </View>
      )}

      {enrichedBudgets.map((b) => (
        <View key={b.id} style={styles.card}>
          <Pressable onPress={() => openEditBudget(b)}>
            <Text style={styles.cardTitle}>{b.title}</Text>
            <Text style={styles.cardSubtitle}>
              {b.category ? `Category: ${b.category}` : 'All expenses'}
            </Text>
            <Text style={styles.cardSubtitle}>
              Budget: £{b.amount.toFixed(2)} · Spent: £
              {b.spent.toFixed(2)} · Remaining: £
              {b.remaining.toFixed(2)}
            </Text>

            {/* Simple progress bar */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${b.pct}%` }]} />
            </View>
            <Text style={styles.progressLabel}>
              {Math.round(b.pct)}% of budget used
            </Text>
          </Pressable>

          <View style={styles.cardActions}>
            <Pressable onPress={() => openEditBudget(b)}>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(b)}>
              <Text style={[styles.actionText, styles.deleteText]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Editor panel */}
      <View style={styles.editorContainer}>
        {editing.mode === 'none' ? (
          <Pressable style={styles.addButton} onPress={openNewBudget}>
            <Text style={styles.addButtonText}>Add budget</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.editorTitle}>
              {editing.mode === 'edit' ? 'Edit budget' : 'New budget'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g. Groceries, Rent, Eating out"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount (£ per month)</Text>
              <TextInput
                style={styles.input}
                value={formAmount}
                onChangeText={setFormAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Category (optional)</Text>
              <TextInput
                style={styles.input}
                value={formCategory}
                onChangeText={setFormCategory}
                placeholder="Leave blank to apply to all expenses"
                placeholderTextColor="#6b7280"
              />
              {categories.length > 0 && (
                <View style={styles.categoryHint}>
                  <Text style={styles.hintLabel}>Existing categories:</Text>
                  <View style={styles.categoryChipRow}>
                    {categories.map((c) => (
                      <Pressable
                        key={c}
                        style={styles.categoryChip}
                        onPress={() => setFormCategory(c)}
                      >
                        <Text style={styles.categoryChipText}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.editorButtons}>
              <Pressable style={styles.cancelBtn} onPress={closeEditor}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>
                  {editing.mode === 'edit' ? 'Save' : 'Add'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
  },
  emptyBox: {
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  progressLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    columnGap: 16,
  },
  actionText: {
    color: '#93C5FD',
    fontSize: 13,
  },
  deleteText: {
    color: '#F97373',
  },
  editorContainer: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  addButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  addButtonText: {
    color: '#BFDBFE',
    fontWeight: '600',
  },
  editorTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#E5E7EB',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#111827',
    color: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  categoryHint: {
    marginTop: 8,
  },
  hintLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  categoryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  categoryChipText: {
    color: '#E5E7EB',
    fontSize: 11,
  },
  editorButtons: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#111827',
  },
  cancelText: {
    color: '#E5E7EB',
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  saveText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default BudgetsScreen;
