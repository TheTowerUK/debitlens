// src/reports/components/TransactionList.tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import type { Transaction } from '../../state/AppContext';
import { formatDateDDMMYYYY } from '../../utils/formatDate';

const TYPE_INCOME: 'income' = 'income';
const EMPTY = '';
const BULLET = ' • ';
const ACCOUNT_FALLBACK = 'Account';

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
    (accounts || []).forEach((a: any) => a?.id && map.set(a.id, a.name || ACCOUNT_FALLBACK));
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
      {txs.map((t) => {
        const amt = Number(t.amount) || 0;
        const isIncome = t.type === TYPE_INCOME;
        const accountName = t.accountId ? accountNameById.get(t.accountId) : undefined;

        // ✅ remove raw '' literals
        const note = t.description || EMPTY;
        const dateLabel = t.date ? formatDateDDMMYYYY(t.date) : EMPTY;

        // ✅ avoid template literal that includes a string literal with spaces
        const meta = (accountName || ACCOUNT_FALLBACK) + (dateLabel ? `${BULLET}${dateLabel}` : EMPTY);

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

              <Text style={styles.txMeta}>{meta}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
