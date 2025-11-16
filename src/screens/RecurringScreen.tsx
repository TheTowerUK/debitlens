// src/screens/RecurringScreen.tsx
import React, { useState } from 'react';
import {  View,  Text,  StyleSheet,  FlatList,  Pressable,  Platform,} from 'react-native';

// We deliberately *do not* use useApp/AppState here yet, to avoid
// relying on non-existent state.recurring or actions.addRecurring, etc.

type RecurringItem = {
  id: string;
  label: string;
  amount: number;
  type: 'income' | 'expense';
  cadence: 'weekly' | 'monthly' | 'yearly';
};

const initialMock: RecurringItem[] = [
  {
    id: '1',
    label: 'Rent',
    amount: 950,
    type: 'expense',
    cadence: 'monthly',
  },
  {
    id: '2',
    label: 'Salary',
    amount: 2500,
    type: 'income',
    cadence: 'monthly',
  },
];

export default function RecurringScreen() {
  const [items, setItems] = useState<RecurringItem[]>(initialMock);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Recurring</Text>
      <Text style={styles.subtle}>
        Regular incomes and expenses that repeat automatically.
      </Text>

      {items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No recurring items</Text>
          <Text style={styles.emptyText}>
            Add recurring income or expense items from the transaction editor.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.caption}>
                  {item.cadence === 'weekly'
                    ? 'Repeats weekly'
                    : item.cadence === 'monthly'
                    ? 'Repeats monthly'
                    : 'Repeats yearly'}
                </Text>
                <View style={styles.pillRow}>
                  <View
                    style={[
                      styles.typePill,
                      item.type === 'income'
                        ? styles.incomePill
                        : styles.expensePill,
                    ]}
                  >
                    <Text style={styles.typePillText}>
                      {item.type === 'income' ? 'income' : 'expense'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.amountCol}>
                <Text
                  style={[
                    styles.amountText,
                    item.type === 'income'
                      ? styles.amountIncome
                      : styles.amountExpense,
                  ]}
                >
                  {item.type === 'income' ? '+' : '-'}
                  £{item.amount.toFixed(2)}
                </Text>

                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => removeItem(item.id)}
                >
                  <Text style={styles.deleteText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
  },
  emptyBox: {
    marginTop: 32,
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
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 10,
  },
  label: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  incomePill: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
  },
  expensePill: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  typePillText: {
    color: '#E5E7EB',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  amountIncome: {
    color: '#22C55E',
  },
  amountExpense: {
    color: '#F97373',
  },
  deleteBtn: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  deleteText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
});
