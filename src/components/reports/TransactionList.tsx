// src/reports/components/TransactionList.tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { Transaction } from '../../state/AppContext';
import { formatDateDDMMYYYY } from '../../utils/formatDate';

function formatGBP(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  } catch {
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return `${sign}£${abs.toFixed(2)}`;
  }
}

export function TransactionList({
  txs,
  accounts,
  styles,
}: {
  txs: Transaction[];
  accounts: any[];
  styles: any;
}) {
  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    (accounts || []).forEach((a: any) => a?.id && map.set(a.id, a.name || 'Account'));
    return map;
  }, [accounts]);

  if (txs.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No transactions match this filter</Text>
        <Text style={styles.emptyText}>
          Try changing the month/period or add transactions in this category.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {txs.map(t => {
        const amt = Number(t.amount) || 0;
        const isIncome = t.type === 'income';
        const accountName = t.accountId ? accountNameById.get(t.accountId) : undefined;
        const note = t.description || '';
        const dateLabel = t.date ? formatDateDDMMYYYY(t.date) : '';

        return (
          <View key={t.id} style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.txLabel, isIncome ? styles.positiveText : styles.negativeText]}>
                {isIncome ? '+' : '-'}
                {formatGBP(Math.abs(amt))}
              </Text>

              {note ? <Text style={styles.txNote}>{note}</Text> : null}

              <Text style={styles.txMeta}>
                {(accountName || 'Account') + (dateLabel ? ` • ${dateLabel}` : '')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
