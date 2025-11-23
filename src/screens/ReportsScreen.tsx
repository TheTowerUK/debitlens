// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
} from 'react-native';
import { useApp, type Transaction } from '../state/AppProvider';
import { formatDateDDMMYYYY } from '../utils/formatDate';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

type PeriodKey = 'thisMonth' | 'lastMonth' | 'allTime';

type ReportsNav = NativeStackNavigationProp<RootStackParamList, 'Reports'>;


const ReportsScreen: React.FC = () => {
  const { state } = useApp();
  const txs: Transaction[] = state.transactions || [];

  const navigation = useNavigation<ReportsNav>();
  const [period, setPeriod] = useState<PeriodKey>('thisMonth');

  // Work out date boundaries for periods
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;

      switch (period) {
        case 'thisMonth':
          return d >= thisMonthStart && d < nextMonthStart;
        case 'lastMonth':
          return d >= lastMonthStart && d < lastMonthEnd;
        case 'allTime':
        default:
          return true;
      }
    });
  }, [txs, period, thisMonthStart, nextMonthStart, lastMonthStart, lastMonthEnd]);

  // Summary totals
  const { totalIncome, totalExpense, net } = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of filteredTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else expense += amt;
    }

    return {
      totalIncome: income,
      totalExpense: expense,
      net: income - expense,
    };
  }, [filteredTxs]);

  // Category breakdown (expenses only)
  const categoryRows = useMemo(() => {
    const map = new Map<string, number>();

    filteredTxs.forEach((t) => {
      if (t.type !== 'expense') return;
      const amt = Number(t.amount) || 0;
      const key = t.category || 'Uncategorised';
      map.set(key, (map.get(key) || 0) + amt);
    });

    const rows = Array.from(map.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));

    rows.sort((a, b) => b.amount - a.amount); // biggest first
    return rows;
  }, [filteredTxs]);

  const periodLabel = (() => {
    const monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ];
    if (period === 'thisMonth') {
      return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    }
    if (period === 'lastMonth') {
      const tmp = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${monthNames[tmp.getMonth()]} ${tmp.getFullYear()}`;
    }
    return 'All time';
  })();

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>Overview for {periodLabel}</Text>

      {/* Period selector */}
      <View style={styles.periodRow}>
        <PeriodChip
          label="This month"
          active={period === 'thisMonth'}
          onPress={() => setPeriod('thisMonth')}
        />
        <PeriodChip
          label="Last month"
          active={period === 'lastMonth'}
          onPress={() => setPeriod('lastMonth')}
        />
        <PeriodChip
          label="All time"
          active={period === 'allTime'}
          onPress={() => setPeriod('allTime')}
        />
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            £{totalIncome.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Spending</Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            £{totalExpense.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={styles.summaryLabel}>Net</Text>
          <Text
            style={[
              styles.summaryValue,
              net >= 0 ? styles.incomeText : styles.expenseText,
            ]}
          >
            {net >= 0 ? '+' : '-'}£{Math.abs(net).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Category breakdown */}
      <Text style={styles.sectionTitle}>Spending by category</Text>
      {categoryRows.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No expenses in this period</Text>
          <Text style={styles.emptyText}>
            Once you add expenses, they&apos;ll be summarised here by category.
          </Text>
        </View>
      ) : (
  <View style={styles.card}>
    {categoryRows.map((row) => (
      <Pressable
        key={row.category}
        style={styles.row}
        onPress={() =>
          navigation.navigate('ReportDetail', {
            categoryKey: row.category,
            period,
          })
        }
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.categoryLabel}>{row.category}</Text>
        </View>
        <Text style={styles.amountText}>
          £{row.amount.toFixed(2)}
        </Text>
      </Pressable>
    ))}
  </View>
)}
      {/* Transactions list for this period */}
      <Text style={styles.sectionTitle}>Transactions in this period</Text>
      {filteredTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity</Text>
          <Text style={styles.emptyText}>
            No transactions match this period filter.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {filteredTxs
            .slice()
            .sort((a, b) => {
              const da = a.date ? Date.parse(a.date) : 0;
              const db = b.date ? Date.parse(b.date) : 0;
              return db - da;
            })
            .map((t) => {
              const isIncome = t.type === 'income';
              const sign = isIncome ? '+' : '-';
              const label = t.category || 'Uncategorised';
              const note = t.note || '';
              return (
                <View key={t.id} style={styles.txRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txLabel}>{label}</Text>
                    {note ? <Text style={styles.txNote}>{note}</Text> : null}
                    {t.date ? (
                      <Text style={styles.txMeta}>
                        {formatDateDDMMYYYY(t.date)}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      isIncome ? styles.incomeText : styles.expenseText,
                    ]}
                  >
                    {sign}£{Number(t.amount).toFixed(2)}
                  </Text>
                </View>
              );
            })}
        </View>
      )}
    </ScrollView>
  );
};

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

const PeriodChip: React.FC<ChipProps> = ({ label, active, onPress }) => (
  <Pressable
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
  >
    <Text
      style={[styles.chipText, active && styles.chipTextActive]}
    >
      {label}
    </Text>
  </Pressable>
);

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
  periodRow: {
    flexDirection: 'row',
    marginBottom: 16,
    columnGap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#020617',
  },
  chipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#111827',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#BFDBFE',
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 8,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  incomeText: {
    color: '#22C55E',
  },
  expenseText: {
    color: '#F97373',
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyBox: {
    marginTop: 4,
    marginBottom: 12,
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
    padding: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryLabel: {
    color: '#F9FAFB',
    fontSize: 14,
  },
  amountText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  txLabel: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
  },
  txNote: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  txMeta: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 12,
  },
});

export default ReportsScreen;
