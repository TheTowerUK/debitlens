// src/screens/Payments.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Payments'>;

export default function PaymentsScreen({}: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];

  // Treat "payments" as outgoing transactions (expenses)
  const payments = txs.filter((t) => t.type === 'expense');

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Payments</Text>
      <Text style={styles.subtle}>
        Regular and recent outgoing payments.
      </Text>

      {payments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No payments yet</Text>
          <Text style={styles.emptyText}>
            Add an expense transaction to see it listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payeeText}>
                  {item.note || 'Payment'}
                </Text>
                <Text style={styles.metaText}>
                  {item.category || 'Uncategorised'}
                </Text>
                {item.date ? (
                  <Text style={styles.metaText}>{item.date}</Text>
                ) : null}
              </View>
              <Text style={styles.amountText}>
                -£{Number(item.amount).toFixed(2)}
              </Text>
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
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 16,
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
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 10,
  },
  payeeText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  amountText: {
    color: '#F97373',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 12,
  },
});
