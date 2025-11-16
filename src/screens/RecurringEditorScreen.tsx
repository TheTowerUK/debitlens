// src/screens/RecurringEditorScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../state/AppProvider';

import type {
  RecurringItem,
  RecurringFrequency,
} from '../state/AppProvider';

type RouteParams = {
  id?: string;
};

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

const RecurringEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>(); // can be typed later with RootStackParamList
  const route = useRoute<any>();
  const { state, actions } = useApp();

  const params: RouteParams = route.params || {};
  const editingId = params.id;

  const existing: RecurringItem | undefined = useMemo(
    () => state.recurring.find((r) => r.id === editingId),
    [state.recurring, editingId]
  );

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : ''
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    existing?.frequency ?? 'monthly'
  );
  const [type, setType] = useState<'income' | 'expense'>(
    existing?.type ?? 'expense'
  );
  const [active, setActive] = useState<boolean>(
    existing?.active ?? true
  );

  const onSave = () => {
    const cleanTitle = title.trim();
    const numericAmount = Number(amount);

    if (!cleanTitle) {
      Alert.alert('Missing title', 'Please enter a title.');
      return;
    }

    if (!numericAmount || isNaN(numericAmount)) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (existing) {
      actions.updateRecurring(existing.id, {
        title: cleanTitle,
        amount: numericAmount,
        frequency,
        type,
        active,
      });
    } else {
      const id = `rec_${Date.now()}`;
      const now = new Date();
      const nextDueDate = now.toISOString();

      const item: RecurringItem = {
        id,
        title: cleanTitle,
        amount: numericAmount,
        frequency,
        type,
        active,
        nextDueDate,
      };

      actions.addRecurring(item);
    }

    navigation.goBack();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete recurring payment',
      `Are you sure you want to delete "${existing.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            actions.deleteRecurring(existing.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const screenTitle = existing ? 'Edit Recurring' : 'Add Recurring';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>{screenTitle}</Text>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Netflix, Rent, Salary"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Type */}
        <View style={styles.field}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.chip,
                type === 'expense' && styles.chipSelected,
              ]}
              onPress={() => setType('expense')}
            >
              <Text
                style={[
                  styles.chipText,
                  type === 'expense' && styles.chipTextSelected,
                ]}
              >
                Expense
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                type === 'income' && styles.chipSelected,
              ]}
              onPress={() => setType('income')}
            >
              <Text
                style={[
                  styles.chipText,
                  type === 'income' && styles.chipTextSelected,
                ]}
              >
                Income
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Frequency */}
        <View style={styles.field}>
          <Text style={styles.label}>Frequency</Text>
          <View style={styles.rowWrap}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.chip,
                  frequency === f && styles.chipSelected,
                ]}
                onPress={() => setFrequency(f)}
              >
                <Text
                  style={[
                    styles.chipText,
                    frequency === f && styles.chipTextSelected,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Active toggle */}
        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.chip,
                active && styles.chipSelected,
              ]}
              onPress={() => setActive(true)}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextSelected,
                ]}
              >
                Active
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                !active && styles.chipSelected,
              ]}
              onPress={() => setActive(false)}
            >
              <Text
                style={[
                  styles.chipText,
                  !active && styles.chipTextSelected,
                ]}
              >
                Paused
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Save / Delete buttons */}
        <View style={styles.buttonRow}>
          {existing && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          )}

          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnText}>
              {existing ? 'Save Changes' : 'Add Recurring'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#e5e7eb',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#111827',
    color: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    columnGap: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#f9fafb',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  deleteBtnText: {
    color: '#f87171',
    fontWeight: '500',
  },
});

export default RecurringEditorScreen;
