// src/screens/ReportScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useApp } from '../state/AppState';
import { startEndForPreset, filterTxns, totals, byCategory, byDay } from '../utils/reports';

// Optional charts: guard require so the app still runs if victory-native isn't installed
let VictoryBar, VictoryChart, VictoryPie, VictoryAxis;
let HAS_CHARTS = false;
try {
  ({ VictoryBar, VictoryChart, VictoryPie, VictoryAxis } = require('victory-native'));
  HAS_CHARTS = true;
} catch (e) {
  HAS_CHARTS = false;
}

const PRESETS = [
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'LAST_MONTH', label: 'Last Month' },
  { key: 'THIS_WEEK',  label: 'This Week'  },
];

const fmt = (n) => Number(n || 0).toFixed(2);

export default function ReportScreen() {
  const { state } = useApp(); // expects state.transactions and state.accounts
  const [preset, setPreset] = useState('THIS_MONTH');
  const [accountId, setAccountId] = useState(undefined);
  const [category, setCategory] = useState(undefined);

  const { start, end } = useMemo(() => startEndForPreset(preset), [preset]);

  const data = useMemo(() => {
    const txns = filterTxns(state.transactions ?? [], { dateStart: start, dateEnd: end, accountId, category });
    return {
      list: txns,
      totals: totals(txns),
      byCat: byCategory(txns),
      byDay: byDay(txns),
    };
  }, [state.transactions, start, end, accountId, category]);

  return (
    <FlatList
      ListHeaderComponent={
        <View style={styles.container}>
          <Text style={styles.title}>Reports</Text>

          {/* Chart availability banner */}
          {!HAS_CHARTS && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Charts unavailable — install {'"victory-native"'} and {'"react-native-svg"'}. 
                Example: npx expo install victory-native react-native-svg
              </Text>
            </View>
          )}

          {/* Preset filter */}
          <View style={styles.row}>
            {PRESETS.map(p => (
              <Pressable key={p.key} onPress={() => setPreset(p.key)} style={[styles.chip, preset === p.key && styles.chipActive]}>
                <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.cards}>
            <View style={[styles.card, styles.income]}>
              <Text style={styles.cardLabel}>Income</Text>
              <Text style={styles.cardValue}>£{fmt(data.totals.income)}</Text>
            </View>
            <View style={[styles.card, styles.expense]}>
              <Text style={styles.cardLabel}>Expense</Text>
              <Text style={styles.cardValue}>£{fmt(data.totals.expense)}</Text>
            </View>
            <View style={[styles.card, styles.net]}>
              <Text style={styles.cardLabel}>Net</Text>
              <Text style={styles.cardValue}>£{fmt(data.totals.net)}</Text>
            </View>
          </View>

          {/* Bar: daily net */}
          {HAS_CHARTS && data.byDay.length > 0 && (
            <View style={styles.chartBlock}>
              <Text style={styles.sectionTitle}>Daily Net</Text>
              <VictoryChart>
                <VictoryAxis tickFormat={(t) => String(t).slice(5)} />
                <VictoryBar data={data.byDay} x="date" y="value" />
              </VictoryChart>
            </View>
          )}

          {/* Pie: by category */}
          {HAS_CHARTS && data.byCat.length > 0 && (
            <View style={styles.chartBlock}>
              <Text style={styles.sectionTitle}>By Category (Net)</Text>
              <VictoryPie
                data={data.byCat.map(d => ({ x: d.category, y: Math.abs(d.value) }))}
                innerRadius={60}
                labels={({ datum }) => `${datum.x}\n£${Number(datum.y).toFixed(0)}`}
              />
            </View>
          )}

          {/* Filters (account/category) — simple tap-to-cycle for now */}
          <View style={styles.row}>
            <Pressable
              style={styles.pill}
              onPress={() => {
                const ids = (state.accounts ?? []).map(a => a.id);
                if (!ids.length) return;
                if (!accountId) { setAccountId(ids[0]); return; }
                const idx = ids.indexOf(accountId);
                setAccountId(idx === -1 || idx === ids.length - 1 ? undefined : ids[idx + 1]);
              }}>
              <Text style={styles.pillText}>Account: {accountId ?? 'All'}</Text>
            </Pressable>

            <Pressable
              style={styles.pill}
              onPress={() => {
                const cats = Array.from(new Set((state.transactions ?? []).map(t => t.category)));
                if (!cats.length) return;
                if (!category) { setCategory(cats[0]); return; }
                const idx = cats.indexOf(category);
                setCategory(idx === -1 || idx === cats.length - 1 ? undefined : cats[idx + 1]);
              }}>
              <Text style={styles.pillText}>Category: {category ?? 'All'}</Text>
            </Pressable>
          </View>

          <Text style={styles.subtle}>
            Range: {start.toISOString().slice(0,10)} → {end.toISOString().slice(0,10)}
          </Text>

          <Text style={styles.sectionTitle}>Transactions</Text>
        </View>
      }
      data={data.list}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => (
        <View style={styles.txnRow}>
          <Text style={styles.txnDate}>{item.date.slice(0,10)}</Text>
          <Text style={styles.txnCat}>{item.category}</Text>
          <Text style={[styles.txnAmt, item.type === 'expense' ? styles.red : styles.green]}>
            {item.type === 'expense' ? '-' : '+'}£{fmt(item.amount)}
          </Text>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 8, flexWrap: 'wrap' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { color: '#111' },
  chipTextActive: { color: 'white' },
  cards: { flexDirection: 'row', gap: 8, marginTop: 8 },
  card: { flex: 1, padding: 12, borderRadius: 12 },
  income: { backgroundColor: '#DCFCE7' },
  expense: { backgroundColor: '#FEE2E2' },
  net: { backgroundColor: '#E0E7FF' },
  cardLabel: { fontSize: 12, color: '#374151' },
  cardValue: { fontSize: 18, fontWeight: '700' },
  chartBlock: { marginTop: 16, padding: 8, borderRadius: 12, backgroundColor: '#F9FAFB' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6' },
  pillText: { fontSize: 13 },
  subtle: { color: '#6B7280', marginTop: 4 },
  banner: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 8, marginBottom: 8 },
  bannerText: { color: '#92400E', fontSize: 12 },
  txnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  txnDate: { width: 100, color: '#374151' },
  txnCat: { flex: 1, color: '#374151' },
  txnAmt: { width: 110, textAlign: 'right', fontWeight: '700' },
  red: { color: '#DC2626' },
  green: { color: '#16A34A' },
});
