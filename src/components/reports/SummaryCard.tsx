// src/reports/components/SummaryCard.tsx
import React from 'react';
import { View, Text } from 'react-native';

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

export function SummaryCard({
  totals,
  count,
  styles,
}: {
  totals: { income: number; expense: number; net: number };
  count: number;
  styles: any;
}) {
  return (
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
          <Text style={[styles.summaryValue, totals.net >= 0 ? styles.positiveText : styles.negativeText]}>
            {formatGBP(totals.net)}
          </Text>
          <Text style={styles.summarySub}>
            {`${count} transaction${count === 1 ? '' : 's'} in this period`}
          </Text>
        </View>
        <View style={styles.summaryItem} />
      </View>
    </View>
  );
}
