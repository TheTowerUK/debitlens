// src/screens/BudgetEditorScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function BudgetEditorScreen({ navigation, route }: any) {
  const { state, actions } = useApp();
  const budgets = (state as any).budgets || [];

  const editId: string | undefined = route?.params?.id;
  const isEdit = !!editId;

  const existing = useMemo(() => {
    if (!editId) return null;
    return budgets.find((b: any) => b.id === editId) || null;
  }, [budgets, editId]);

  const [name, setName] = useState<string>(existing?.name ?? '');
  const [category, setCategory] = useState<string>(existing?.category ?? '');
  const [limit, setLimit] = useState<string>(
    existing?.limit != null ? String(existing.limit) : ''
  );

  const canWrite =
    typeof (actions as any)?.addBudget === 'function' &&
    typeof (actions as any)?.updateBudget === 'function' &&
    typeof (actions as any)?.deleteBudget === 'function';

  const onSave = () => {
    const cat = category.trim();
    const nm = name.trim();
    const lim = Number(limit);

    if (!cat) {
      Alert.alert('Category required', 'Please enter a category for this budget.');
      return;
    }
    if (!isFinite(lim) || lim <= 0) {
      Alert.alert('Invalid limit', 'Please enter a budget limit greater than 0.');
      return;
    }

    if (!canWrite) {
      Alert.alert(
        'Not wired yet',
        'Budget actions (add/update/delete) are not wired in AppContext yet.'
      );
      return;
    }

    if (isEdit) {
      (actions as any).updateBudget(editId, { name: nm || cat, category: cat, limit: lim });
    } else {
      (actions as any).addBudget({ id: uid(), name: nm || cat, category: cat, limit: lim });
    }

    navigation.goBack();
  };

  const onDelete = () => {
    if (!isEdit) return;

    if (!canWrite) {
      Alert.alert(
        'Not wired yet',
        'Budget actions (add/update/delete) are not wired in AppContext yet.'
      );
      return;
    }

    Alert.alert('Delete budget?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          (actions as any).deleteBudget(editId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{isEdit ? 'Edit budget' : 'Add budget'}</Text>
            <Text style={styles.subtle}>
              Budgets match by category name (must align with your transaction category).
            </Text>
          </View>

          <Pressable style={styles.headerPill} onPress={() => navigation.goBack()}>
            <Text style={styles.headerPillText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Name (optional)</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Groceries"
            placeholderTextColor="#6B7280"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Category (required)</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Groceries"
            placeholderTextColor="#6B7280"
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Monthly limit (£)</Text>
          <TextInput
            style={styles.input}
            value={limit}
            onChangeText={setLimit}
            keyboardType="numeric"
            placeholder="e.g. 300"
            placeholderTextColor="#6B7280"
          />

          {!canWrite && (
            <Text style={[styles.subtle, { marginTop: 12 }]}>
              Note: add/update/delete budget actions are not wired in AppContext yet.
              The screen is ready, but saving will be disabled.
            </Text>
          )}

          <View style={{ flexDirection: 'row', columnGap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <Pressable style={styles.btnPrimary} onPress={onSave}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </Pressable>

            {isEdit && (
              <Pressable style={[styles.btnSecondary, styles.btnDanger]} onPress={onDelete}>
                <Text style={[styles.btnSecondaryText, { color: '#FCA5A5' }]}>Delete</Text>
              </Pressable>
            )}

            <Pressable style={styles.btnSecondary} onPress={() => navigation.goBack()}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  wrap: { padding: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 12,
  },
  h1: { color: '#ffffff', fontSize: 26, fontWeight: '800' },
  subtle: { color: theme.textDim, marginTop: 4 },

  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: theme.card,
  },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: { color: theme.textDim, fontSize: 12, marginBottom: 6, fontWeight: '700' },
  input: {
    color: theme.text,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },

  btnPrimary: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },

  btnSecondary: {
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnSecondaryText: { color: theme.pillText, fontWeight: '800' },

  btnDanger: {
    borderColor: '#7F1D1D',
  },
});
