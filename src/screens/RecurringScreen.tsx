// src/screens/RecurringScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../state/AppProvider';
import type {  RecurringItem,  RecurringFrequency,} from '../state/AppProvider';

// Map internal values to pretty labels
const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const RecurringScreen: React.FC = () => {
  const navigation = useNavigation<any>(); // you can later replace `any` with your typed stack param list
  const { state, actions } = useApp();

  const recurring: RecurringItem[] = state.recurring || [];

  const handleToggleActive = (item: RecurringItem) => {
    actions.updateRecurring(item.id, { active: !item.active });
  };

  const handleDelete = (item: RecurringItem) => {
    actions.deleteRecurring(item.id);
  };

  const handleEdit = (item: RecurringItem) => {
    // Adjust route name if your navigator uses something else
    navigation.navigate('RecurringEditor', { id: item.id });
  };

  const handleAddNew = () => {
    navigation.navigate('RecurringEditor');
  };

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.h1}>Recurring Payments</Text>

      {recurring.length === 0 && (
        <Text style={styles.subtle}>
          No recurring items yet. Tap "Add Recurring" to create one.
        </Text>
      )}

      {recurring.map((r) => (
        <View key={r.id} style={styles.card}>
          <Pressable onPress={() => handleEdit(r)}>
            <Text style={styles.itemTitle}>{r.title}</Text>
            <Text style={styles.itemSubtitle}>
              £
              {typeof r.amount === 'number'
                ? r.amount.toFixed(2)
                : r.amount}{' '}
              • {FREQUENCY_LABEL[r.frequency]}
              {r.type
                ? ` • ${r.type === 'income' ? 'Income' : 'Expense'}`
                : ''}
            </Text>
            {r.nextDueDate && (
              <Text style={styles.subtle}>
                Next due:{' '}
                {new Date(r.nextDueDate).toLocaleDateString()}
              </Text>
            )}
          </Pressable>

          <View style={styles.rowActions}>
            <Pressable onPress={() => handleToggleActive(r)}>
              <Text style={[styles.badge, r.active ? styles.badgeActive : styles.badgePaused]}>
                {r.active ? 'Active' : 'Paused'}
              </Text>
            </Pressable>

            <Pressable onPress={() => handleDelete(r)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.button} onPress={handleAddNew}>
        <Text style={styles.buttonText}>Add Recurring</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  subtle: {
    color: '#9ca3af',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  itemSubtitle: {
    color: '#9ca3af',
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    columnGap: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    overflow: 'hidden',
  },
  badgeActive: {
    color: '#22c55e',
  },
  badgePaused: {
    color: '#fbbf24',
  },
  deleteText: {
    color: '#f87171',
    fontSize: 14,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default RecurringScreen;
