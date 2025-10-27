// src/components/ReportChart.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  VictoryBar,
  VictoryChart,
  VictoryAxis,
  VictoryPie,
} from 'victory';

import { byDay, byCategory } from '../utils/reportUtils';
import type { Transaction } from '../types/finance';

type Props = {
  txns: Transaction[];
  mode?: 'daily' | 'category';
};

export default function ReportChart({ txns, mode = 'daily' }: Props) {
  if (!txns.length) return <Text style={styles.empty}>No transactions to chart</Text>;

  const data = mode === 'daily'
    ? byDay(txns).map(d => ({ x: d.date.slice(5), y: d.value }))
    : byCategory(txns).map(c => ({ x: c.category, y: c.value }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {mode === 'daily' ? 'Daily Cashflow' : 'By Category'}
      </Text>

      {mode === 'daily' ? (
        <VictoryChart domainPadding={10}>
          <VictoryAxis fixLabelOverlap />
          <VictoryAxis dependentAxis />
          <VictoryBar data={data} style={{ data: { fill: '#3B82F6' } }} />
        </VictoryChart>
      ) : (
        <VictoryPie
          data={data}
          labels={({ datum }) => `${datum.x}: ${datum.y.toFixed(2)}`}
          colorScale="qualitative"
          padAngle={2}
          innerRadius={40}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  empty: { color: '#9CA3AF', fontStyle: 'italic', marginTop: 12 },
});
