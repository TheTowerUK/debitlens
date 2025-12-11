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

const ReportDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { categoryKey, period } = route.params;
  const { state } = useApp();
  const txs: Transaction[] = state.transactions || [];
  const accounts = state.accounts || [];

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;

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

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (t.type !== 'expense') return false;
      if (!t.date) return false;

      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;

      // Period filter
      let inPeriod = false;
      switch (period) {
        case 'thisMonth':
          inPeriod = d >= thisMonthStart && d < nextMonthStart;
          break;
        case 'lastMonth':
          inPeriod = d >= lastMonthStart && d < lastMonthEnd;
          break;
        case 'allTime':
        default:
          inPeriod = true;
          break;
      }
      if (!inPeriod) return false;

      // Category filter: "Uncategorised" key means no category
      if (categoryKey === 'Uncategorised') {
        return !t.category;
      }

      return t.category === categoryKey;
    });
  }, [txs, period, categoryKey, thisMonthStart, nextMonthStart, lastMonthStart, lastMonthEnd]);

  const totalSpent = useMemo(
    () =>
      filteredTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [filteredTxs]
  );

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts as any[]).forEach((a) => {
      if (a.id) {
        map.set(a.id, a.name || 'Account');
      }
    });
    return map;
  }, [accounts]);

  const title =
    categoryKey === 'Uncategorised' ? 'Uncategorised spending' : categoryKey;

  const sortedTxs = useMemo(
    () =>
      filteredTxs.slice().sort((a, b) => {
        const da = a.date ? Date.parse(a.date) : 0;
        const db = b.date ? Date.parse(b.date) : 0;
        return db - da;
      }),
    [filteredTxs]
  );

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Header row with back */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'} Back</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>{title}</Text>
          <Text style={styles.subtle}>Period: {periodLabel}</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total spent</Text>
        <Text style={styles.summaryValue}>£{totalSpent.toFixed(2)}</Text>
        <Text style={styles.summarySub}>
          {sortedTxs.length} transaction
          {sortedTxs.length === 1 ? '' : 's'} in this period
        </Text>
      </View>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>
      {sortedTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No expenses match this filter</Text>
          <Text style={styles.emptyText}>
            Try changing the period or adding expenses in this category.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {sortedTxs.map((t) => {
            const amt = Number(t.amount) || 0;
            const accountName = t.accountId
              ? accountNameById.get(t.accountId)
              : undefined;
            const note = t.description || '';
            const dateLabel = t.date ? formatDateDDMMYYYY(t.date) : '';

            return (
              <View key={t.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>
                    £{amt.toFixed(2)}
                  </Text>
                  {note ? <Text style={styles.txNote}>{note}</Text> : null}
                  <Text style={styles.txMeta}>
                    {accountName ? (
                      <Text style={styles.txMeta}>{accountName}</Text>
                    ) : (
                      <Text style={styles.txMeta}>Account</Text>
                    )}
                    {dateLabel ? (
                      <Text style={styles.txMeta}> • {dateLabel}</Text>
                    ) : null}
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
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
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
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  summarySub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
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
  txRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  txLabel: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  txNote: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  txMeta: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
});

export default ReportDetailScreen;
