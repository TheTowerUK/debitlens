// src/screens/ReportDetailScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp, type Transaction } from '../state/AppContext';
import { formatDateDDMMYYYY } from '../utils/formatDate';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportDetail'>;

function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // YYYY-MM
}

function addMonths(monthKey: string, delta: number) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyFromDate(d);
}

function rangeForMonthKey(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

function formatMonthLabel(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return `${monthKey}`;
  }
}

function formatGBP(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(v);
  } catch {
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return `${sign}£${abs.toFixed(2)}`;
  }
}

const ReportDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state } = useApp();
  const txs: Transaction[] = state.transactions || [];
  const accounts = state.accounts || [];

  const { categoryKey, period, monthKey } = route.params;

  const effectiveMonthKey =
    period === 'month' ? (monthKey || monthKeyFromDate(new Date())) : undefined;

  const range = useMemo(() => {
    if (period === 'allTime') {
      return { start: new Date(0), end: new Date(8640000000000000) };
    }
    if (period === 'thisMonth') {
      return rangeForMonthKey(monthKeyFromDate(new Date()));
    }
    if (period === 'lastMonth') {
      return rangeForMonthKey(addMonths(monthKeyFromDate(new Date()), -1));
    }
    // period === 'month'
    return rangeForMonthKey(effectiveMonthKey!);
  }, [period, effectiveMonthKey]);

  const periodLabel = useMemo(() => {
    if (period === 'allTime') return 'All time';
    if (period === 'thisMonth') return formatMonthLabel(monthKeyFromDate(new Date()));
    if (period === 'lastMonth') return formatMonthLabel(addMonths(monthKeyFromDate(new Date()), -1));
    return effectiveMonthKey ? formatMonthLabel(effectiveMonthKey) : 'Month';
  }, [period, effectiveMonthKey]);

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts as any[]).forEach((a) => {
      if (a?.id) map.set(a.id, a.name || 'Account');
    });
    return map;
  }, [accounts]);

  // ✅ Filter by date range + category
  // ✅ Includes both income + expense to match Reports breakdown
  const filteredTxs = useMemo(() => {
    const { start, end } = range;
    const cat = (categoryKey || '').trim();

    return txs.filter((t) => {
      if (!t.date) return false;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      if (d < start || d >= end) return false;

      const tCat = ((t.category || 'Uncategorised').trim() || 'Uncategorised');

      if (cat === 'Uncategorised') return tCat === 'Uncategorised';
      return tCat === cat;
    });
  }, [txs, range, categoryKey]);

  const sortedTxs = useMemo(() => {
    return filteredTxs.slice().sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
  }, [filteredTxs]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of filteredTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }

    return { income, expense, net: income - expense };
  }, [filteredTxs]);

  const title =
    categoryKey === 'Uncategorised' ? 'Uncategorised' : categoryKey;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'} Back</Text>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{title}</Text>
          <Text style={styles.subtle}>Period: {periodLabel}</Text>
        </View>
      </View>

      {/* Month switcher (only when period=month) */}
      {period === 'month' && effectiveMonthKey && (
        <View style={styles.headerPillsRow}>
          <Pressable
            style={styles.headerPill}
            onPress={() => navigation.setParams({ monthKey: addMonths(effectiveMonthKey, -1) })}
          >
            <Text style={styles.headerPillText}>◀ Prev</Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => navigation.setParams({ monthKey: monthKeyFromDate(new Date()) })}
          >
            <Text style={styles.headerPillText}>This month</Text>
          </Pressable>

          <Pressable
            style={styles.headerPill}
            onPress={() => navigation.setParams({ monthKey: addMonths(effectiveMonthKey, 1) })}
          >
            <Text style={styles.headerPillText}>Next ▶</Text>
          </Pressable>
        </View>
      )}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Summary</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, styles.positiveText]}>{formatGBP(totals.income)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryValue, styles.negativeText]}>{formatGBP(totals.expense)}</Text>
          </View>
        </View>

        <View style={{ height: 10 }} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Net</Text>
            <Text
              style={[
                styles.summaryValue,
                totals.net >= 0 ? styles.positiveText : styles.negativeText,
              ]}
            >
              {formatGBP(totals.net)}
            </Text>
            <Text style={styles.summarySub}>
              {sortedTxs.length} transaction{sortedTxs.length === 1 ? '' : 's'} in this period
            </Text>
          </View>
          <View style={styles.summaryItem} />
        </View>
      </View>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>

      {sortedTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No transactions match this filter</Text>
          <Text style={styles.emptyText}>
            Try changing the month/period or add transactions in this category.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {sortedTxs.map((t) => {
            const amt = Number(t.amount) || 0;
            const isIncome = t.type === 'income';
            const accountName = t.accountId ? accountNameById.get(t.accountId) : undefined;
            const note = t.description || '';
            const dateLabel = t.date ? formatDateDDMMYYYY(t.date) : '';

            return (
              <View key={t.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.txLabel,
                      isIncome ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {isIncome ? '+' : '-'}
                    {formatGBP(Math.abs(amt))}
                  </Text>

                  {note ? <Text style={styles.txNote}>{note}</Text> : null}

                  <Text style={styles.txMeta}>
                    {accountName || 'Account'}
                    {dateLabel ? ` • ${dateLabel}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  wrap: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 32,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  h1: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 2,
  },

  headerPillsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 14,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  headerPillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },

  summaryCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0B1020',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },
  summaryTitle: {
    color: '#E5E7EB',
    fontWeight: '800',
    marginBottom: 8,
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  summaryItem: { flex: 1 },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '900',
  },
  summarySub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 6,
  },

  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },

  emptyBox: {
    marginTop: 4,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#0B1020',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },

  card: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    marginBottom: 12,
  },
  txRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#111827',
  },
  txLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  txNote: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  txMeta: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
  },

  positiveText: { color: '#22C55E' },
  negativeText: { color: '#F97373' },
});

export default ReportDetailScreen;
