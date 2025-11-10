// src/screens/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Reports'>;

type RangeKey = 'this' | 'last' | 'last3';

// Simple inline chart component: draws net-by-month as a line
function NetLineChart({ data }: { data: { x: string; y: number }[] }) {
  const width = 260;
  const height = 140;
  const paddingLeft = 24;
  const paddingRight = 8;
  const paddingTop = 12;
  const paddingBottom = 24;

  if (!data.length) {
    return (
      <Text style={{ color: '#9CA3AF', fontSize: 12 }}>
        Add some transactions to see your trend.
      </Text>
    );
  }

  const ys = data.map(d => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const t = data.length === 1 ? 0.5 : i / (data.length - 1);
    const x = paddingLeft + t * innerWidth;
    const normY = (d.y - minY) / span; // 0..1
    const y = paddingTop + (1 - normY) * innerHeight;
    return { x, y, label: d.x, value: d.y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <Svg width="100%" height={height}>
      {/* horizontal mid-line */}
      <Line
        x1={paddingLeft}
        y1={paddingTop + innerHeight / 2}
        x2={width - paddingRight}
        y2={paddingTop + innerHeight / 2}
        stroke="#1F2937"
        strokeWidth={1}
      />
      {/* line */}
      <Path d={pathD} stroke="#60A5FA" strokeWidth={2} fill="none" />
      {/* dots */}
      {points.map((p, i) => (
        <Path
          key={i}
          d={`M ${p.x} ${p.y} m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0`}
          fill="#93C5FD"
        />
      ))}
      {/* x labels */}
      {points.map((p, i) => (
        <SvgText
          key={`label-${i}`}
          x={p.x}
          y={height - 6}
          fontSize={10}
          fill="#9CA3AF"
          textAnchor="middle"
        >
          {p.label}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function ReportsScreen({ navigation }: Props) {
  const { state } = useApp();
  const txs = state.transactions || [];
  const accounts = state.accounts || [];

  const [range, setRange] = useState<RangeKey>('this');

  // ---- Date / range helpers ----
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  function monthKeyOf(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  const thisMonthKey = monthKeyOf(year, month);

  let lastMonthYear = year;
  let lastMonth = month - 1;
  if (lastMonth === 0) {
    lastMonth = 12;
    lastMonthYear = year - 1;
  }
  const lastMonthKey = monthKeyOf(lastMonthYear, lastMonth);

  const last3Keys: string[] = (() => {
    const keys: string[] = [];
    let y = year;
    let m = month;
    for (let i = 0; i < 3; i++) {
      keys.push(monthKeyOf(y, m));
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    return keys;
  })();

  const { monthLabel, selectedKeys } = useMemo(() => {
    switch (range) {
      case 'this':
        return {
          monthLabel: now.toLocaleString(undefined, {
            month: 'long',
            year: 'numeric',
          }),
          selectedKeys: [thisMonthKey],
        };
      case 'last': {
        const d = new Date(lastMonthYear, lastMonth - 1, 1);
        return {
          monthLabel: d.toLocaleString(undefined, {
            month: 'long',
            year: 'numeric',
          }),
          selectedKeys: [lastMonthKey],
        };
      }
      case 'last3':
      default:
        return {
          monthLabel: 'Last 3 months',
          selectedKeys: last3Keys,
        };
    }
  }, [range, thisMonthKey, lastMonthKey, last3Keys, lastMonth, lastMonthYear, now]);

  // ---- Filter txs by selected period ----
  const txsInRange = useMemo(
    () =>
      txs.filter(t => {
        const d = t.date || '';
        const key = d.slice(0, 7); // "YYYY-MM"
        return selectedKeys.includes(key);
      }),
    [txs, selectedKeys]
  );

  const { income, expense, net } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txsInRange) {
      const amt = Number(t.amount || 0);
      if (t.type === 'income') income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [txsInRange]);

  // ---- Top 5 expenses in range ----
  const topExpenses = useMemo(
    () =>
      txsInRange
        .filter(t => t.type !== 'income')
        .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
        .slice(0, 5),
    [txsInRange]
  );

  // ---- Per-account net in range ----
  const byId: Record<string, string> = {};
  accounts.forEach(a => {
    byId[a.id] = a.name || 'Account';
  });

  const perAccount = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    for (const t of txsInRange) {
      const id = t.accountId;
      if (!map[id]) map[id] = { income: 0, expense: 0 };
      const amt = Number(t.amount || 0);
      if (t.type === 'income') map[id].income += amt;
      else map[id].expense += amt;
    }
    const rows = Object.entries(map).map(([id, v]) => ({
      id,
      name: byId[id] || 'Account',
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    return rows;
  }, [txsInRange, byId]);

  // ---- Net-by-month chart (last 6 months) ----
  const chartData = useMemo(() => {
    const months: { key: string; label: string }[] = [];
    let y = year;
    let m = month;
    for (let i = 0; i < 6; i++) {
      const d = new Date(y, m - 1, 1);
      months.unshift({
        key: monthKeyOf(y, m),
        label: d.toLocaleString(undefined, { month: 'short' }),
      });
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }

    const map: Record<string, number> = {};
    for (const t of txs) {
      const d = t.date || '';
      const key = d.slice(0, 7);
      const match = months.find(mm => mm.key === key);
      if (!match) continue;
      const amt = Number(t.amount || 0);
      const sign = t.type === 'income' ? 1 : -1;
      map[key] = (map[key] ?? 0) + sign * amt;
    }

    return months.map(m => ({
      x: m.label,
      y: map[m.key] ?? 0,
    }));
  }, [txs, year, month]);

  const hasChartData = chartData.some(p => p.y !== 0);

  // ---- CSV export for current range ----
  const onExportCsv = async () => {
    try {
      if (!txsInRange.length) {
        Alert.alert('Nothing to export', 'There are no transactions in this range.');
        return;
      }

      const esc = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const header = ['date', 'account', 'type', 'amount', 'note'];
      const lines = txsInRange.map(t => {
        const accName = byId[t.accountId] || 'Account';
        return [
          t.date || '',
          accName,
          t.type || '',
          Number(t.amount || 0),
          t.note || '',
        ]
          .map(esc)
          .join(',');
      });

      const csv = `${header.join(',')}\n${lines.join('\n')}`;

      const base =
        (FileSystem as any).cacheDirectory ??
        (FileSystem as any).documentDirectory ??
        '';
      const path = `${base}report-range-${Date.now()}.csv`;
      const encoding =
        (FileSystem as any).EncodingType?.UTF8 ?? 'utf8';

      await (FileSystem as any).writeAsStringAsync(path, csv, { encoding });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: 'Share report CSV',
        });
      } else {
        Alert.alert('CSV saved', path);
      }
    } catch (e: any) {
      console.warn('[reports] export failed', e);
      Alert.alert('Export failed', e?.message || String(e));
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Reports</Text>
          <Text style={styles.subtle}>{monthLabel}</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
      </View>

      {/* Net-by-month chart */}
      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Net by month</Text>
        {hasChartData ? (
          <NetLineChart data={chartData} />
        ) : (
          <Text style={styles.subtleSmall}>
            Add some transactions to see your trend over the last 6 months.
          </Text>
        )}
      </View>

      {/* Range selector */}
      <View style={styles.rangeRow}>
        <Pressable
          style={[
            styles.rangePill,
            range === 'this' && styles.rangePillActive,
          ]}
          onPress={() => setRange('this')}
        >
          <Text
            style={[
              styles.rangeText,
              range === 'this' && styles.rangeTextActive,
            ]}
          >
            This month
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.rangePill,
            range === 'last' && styles.rangePillActive,
          ]}
          onPress={() => setRange('last')}
        >
          <Text
            style={[
              styles.rangeText,
              range === 'last' && styles.rangeTextActive,
            ]}
          >
            Last month
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.rangePill,
            range === 'last3' && styles.rangePillActive,
          ]}
          onPress={() => setRange('last3')}
        >
          <Text
            style={[
              styles.rangeText,
              range === 'last3' && styles.rangeTextActive,
            ]}
          >
            Last 3 months
          </Text>
        </Pressable>
      </View>

      {/* Summary cards */}
      <View style={styles.cardsRow}>
        <View style={[styles.card, styles.cardGood]}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={styles.cardValue}>£{income.toFixed(2)}</Text>
        </View>
        <View style={[styles.card, styles.cardBad]}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={styles.cardValue}>£{expense.toFixed(2)}</Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.cardLabel}>Net</Text>
        <Text
          style={[
            styles.cardValue,
            net >= 0 ? styles.netPos : styles.netNeg,
          ]}
        >
          {net >= 0 ? '+' : '-'}£{Math.abs(net).toFixed(2)}
        </Text>
        <Text style={styles.subtleSmall}>
          Based on {txsInRange.length} transaction
          {txsInRange.length === 1 ? '' : 's'} in this range.
        </Text>

        {/* Export button */}
        <Pressable style={styles.exportBtn} onPress={onExportCsv}>
          <Text style={styles.exportText}>Export CSV for this range</Text>
        </Pressable>
      </View>

      {/* Per-account net */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>By account</Text>
        {perAccount.length === 0 ? (
          <Text style={styles.subtleSmall}>
            No activity for this range yet.
          </Text>
        ) : (
          perAccount.map(row => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>{row.name}</Text>
                <Text style={styles.rowSub}>
                  Income £{row.income.toFixed(2)} · Expense £
                  {row.expense.toFixed(2)}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  row.net >= 0
                    ? styles.rowAmountIncome
                    : styles.rowAmountExpense,
                ]}
              >
                {row.net >= 0 ? '+' : '-'}£{Math.abs(row.net).toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Top expenses */}
      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.cardTitle}>Top expenses in range</Text>
        {topExpenses.length === 0 ? (
          <Text style={styles.subtleSmall}>No expenses recorded yet.</Text>
        ) : (
          topExpenses.map(tx => {
            const accName = byId[tx.accountId] || 'Account';
            const amt = Number(tx.amount || 0);
            const d = tx.date ? new Date(`${tx.date}T00:00:00`) : null;
            return (
              <View key={String(tx.id)} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowTitle}>
                    {tx.note || 'Expense'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {accName}
                    {d ? ` · ${d.toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, styles.rowAmountExpense]}>
                  -£{amt.toFixed(2)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  subtleSmall: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  backLink: {
    color: '#93C5FD',
    fontWeight: '600',
  },

  // Chart card
  chartCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },

  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  rangePillActive: {
    backgroundColor: '#2563EB',
  },
  rangeText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  rangeTextActive: {
    color: '#F9FAFB',
  },

  cardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
  },
  cardGood: {
    borderColor: '#22C55E33',
    borderWidth: 1,
  },
  cardBad: {
    borderColor: '#F9737333',
    borderWidth: 1,
  },
  cardLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 4,
  },
  cardValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  netPos: {
    color: '#4ADE80',
  },
  netNeg: {
    color: '#F97373',
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },

  exportBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  exportText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 13,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#1F2937',
  },
  rowLeft: {
    flexShrink: 1,
    paddingRight: 8,
  },
  rowTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  rowSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowAmountIncome: {
    color: '#4ADE80',
  },
  rowAmountExpense: {
    color: '#F97373',
  },
});
