// src/components/SummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors as theme } from '../../theme/colors';

export function SummaryCard(props: { title: string; value: string; subtitle?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{props.title}</Text>
      <Text style={styles.value}>{props.value}</Text>
      {!!props.subtitle && <Text style={styles.sub}>{props.subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.textDim, fontSize: 12 },
  value: { color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  sub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
});



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


