// src/screens/HistoryScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [selectedAccountId, setSelectedAccountId] = useState<'all' | string>('all');

  // Small helper: map accountId → name
  const accountNameFor = (id: string | undefined | null): string => {
    if (!id) return 'Unknown account';
    const acc = accounts.find(a => a.id === id);
    return acc?.name || 'Unknown account';
  };

  const filtered = useMemo(() => {
    let list = txs;
    if (selectedAccountId !== 'all') {
      list = list.filter(t => t.accountId === selectedAccountId);
    }
    // newest first by date, then id
    return [...list].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      const cmp = db.localeCompare(da);
      if (cmp !== 0) return cmp;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [txs, selectedAccountId]);

  const monthLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }, []);

  const formatDate = (raw: string | undefined) => {
    if (!raw) return 'No date';
    const s = raw.includes('T') ? raw : `${raw}T00:00:00`;
    const d = new Date(s);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString();
  };

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtle}>
          All transactions · {monthLabel}
        </Text>
      </View>

      {/* ACCOUNT FILTER */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        <Pressable
          onPress={() => setSelectedAccountId('all')}
          style={[
            styles.filterPill,
            selectedAccountId === 'all' && styles.filterPillActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              selectedAccountId === 'all' && styles.filterTextActive,
            ]}
          >
            All accounts
          </Text>
        </Pressable>

        {accounts.map(acc => (
          <Pressable
            key={acc.id}
            onPress={() => setSelectedAccountId(acc.id)}
            style={[
              styles.filterPill,
              selectedAccountId === acc.id && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                selectedAccountId === acc.id && styles.filterTextActive,
              ]}
            >
              {acc.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* LIST */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {filtered.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptySubtle}>
              Add a transaction from the Dashboard to see it appear here.
            </Text>
          </View>
        )}

        {filtered.map(tx => {
          const isIncome = tx.type === 'income';
          const sign = isIncome ? '+' : '−';

          return (
            <View key={tx.id} style={styles.txCard}>
              <View style={styles.txTopRow}>
                <Text style={styles.txAccount}>
                  {accountNameFor(tx.accountId)}
                </Text>
                <Text
                  style={[
                    styles.txAmount,
                    isIncome ? styles.txIncome : styles.txExpense,
                  ]}
                >
                  {sign}£{Math.abs(tx.amount).toFixed(2)}
                </Text>
              </View>

              <View style={styles.txBottomRow}>
                <Text style={styles.txMeta}>
                  {formatDate(tx.date)} · {isIncome ? 'Income' : 'Expense'}
                </Text>
                {tx.note ? (
                  <Text
                    style={styles.txNote}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {tx.note}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* FOOTER / NAVIGATION */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.footerText}>Back to Dashboard</Text>
        </Pressable>

        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('Budgets')}
        >
          <Text style={styles.footerText}>View Budgets</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  header: {
    marginBottom: 8,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 2,
  },
  filterRow: {
    marginTop: 12,
    maxHeight: 40,
  },
  filterPill: {
    backgroundColor: '#020617',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  txCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txAccount: {
    color: '#E5E7EB',
    fontWeight: '600',
    fontSize: 14,
  },
  txAmount: {
    fontWeight: '800',
    fontSize: 15,
  },
  txIncome: {
    color: '#4ADE80',
  },
  txExpense: {
    color: '#F97373',
  },
  txBottomRow: {
    marginTop: 4,
  },
  txMeta: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  txNote: {
    color: '#E5E7EB',
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#111827',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  footerBtnGhost: {
    backgroundColor: '#0B1120',
  },
  footerText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 13,
  },
});
