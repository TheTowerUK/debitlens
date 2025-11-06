// src/screens/BudgetsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';
import * as FileSystem from 'expo-file-system';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;

// simple local file for budget persistence
const BUDGET_FILE_NAME = 'debitlens_budget.json';

export default function BudgetsScreen({ navigation }: Props) {
  const { state } = useApp();
  const [input, setInput] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- load budget from file on mount ----
  useEffect(() => {
    (async () => {
      try {
        const FS: any = FileSystem;
        const base = FS.documentDirectory ?? FS.cacheDirectory ?? '';
        const path = `${base}${BUDGET_FILE_NAME}`;

        const info = await FS.getInfoAsync(path);
        if (!info.exists) {
          setLoading(false);
          return;
        }

        const content = await FS.readAsStringAsync(path);
        const parsed = JSON.parse(content);
        if (typeof parsed?.budget === 'number' && parsed.budget > 0) {
          setBudget(parsed.budget);
          setInput(String(parsed.budget));
        }
      } catch (e) {
        console.warn('[budgets] load budget failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // derive this month's spend from global transactions
  const { monthLabel, spendThisMonth } = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const txs = state.transactions || [];
    let spend = 0;
    for (const t of txs) {
      if (t.type === 'income') continue;
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        spend += t.amount;
      }
    }

    const label = now.toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });

    return { monthLabel: label, spendThisMonth: spend };
  }, [state.transactions]);

  const monthlyBudget = budget ?? 0;
  const remaining = monthlyBudget - spendThisMonth;

  // percentage used (0–1+)
  const usedRatio =
    budget && budget > 0 ? spendThisMonth / budget : 0;

  // clamp 0–1 for the bar
  const clampedRatio = Math.max(0, Math.min(1, usedRatio));

  let barColor = '#22C55E'; // green
  if (usedRatio >= 0.8 && usedRatio < 1) barColor = '#F97316'; // orange
  if (usedRatio >= 1) barColor = '#EF4444'; // red

  const saveBudgetToFile = async (value: number | null) => {
    try {
      const FS: any = FileSystem;
      const base = FS.documentDirectory ?? FS.cacheDirectory ?? '';
      const path = `${base}${BUDGET_FILE_NAME}`;

      if (value === null) {
        // clear file
        try {
          await FS.deleteAsync(path, { idempotent: true });
        } catch {
          // ignore
        }
        return;
      }

      const payload = JSON.stringify({ budget: value });
      if (typeof FS.writeAsStringAsync === 'function') {
        await FS.writeAsStringAsync(path, payload);
      }
    } catch (e) {
      console.warn('[budgets] save budget failed', e);
    }
  };

  const onSave = async () => {
    const value = parseFloat(input.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number.');
      return;
    }
    setBudget(value);
    await saveBudgetToFile(value);
    Alert.alert('Saved', 'Monthly budget updated.');
  };

  const onClear = async () => {
    setBudget(null);
    setInput('');
    await saveBudgetToFile(null);
    Alert.alert('Budget cleared', 'Monthly budget has been removed.');
  };

  const statusText = (() => {
    if (budget === null) {
      return 'No budget set. Set a monthly limit to track your spending.';
    }
    if (remaining >= 0) {
      const pct = usedRatio * 100;
      return `You have £${remaining.toFixed(
        2
      )} left. (${pct.toFixed(0)}% of your budget used)`;
    }
    const over = -remaining;
    const pctOver = (usedRatio - 1) * 100;
    return `You are over budget by £${over.toFixed(
      2
    )} (${pctOver.toFixed(0)}% over).`;
  })();

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>
        Track your monthly spending vs a simple budget.
      </Text>

      {/* BUDGET SETUP */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Monthly budget</Text>
        <Text style={styles.label}>Amount (£)</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={loading ? 'Loading…' : 'e.g. 1500'}
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={styles.input}
          editable={!loading}
        />

        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={onSave}
            disabled={loading}
          >
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={onClear}
            disabled={loading || budget === null}
          >
            <Text style={styles.btnText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      {/* OVERVIEW + PROGRESS BAR */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>This month</Text>
        <Text style={styles.label}>{monthLabel}</Text>

        <Text style={styles.kv}>
          Budget:{' '}
          <Text style={styles.kvValue}>
            {budget !== null ? `£${monthlyBudget.toFixed(2)}` : 'not set'}
          </Text>
        </Text>

        <Text style={styles.kv}>
          Expense:{' '}
          <Text style={[styles.kvValue, styles.red]}>
            £{spendThisMonth.toFixed(2)}
          </Text>
        </Text>

        <Text style={styles.kv}>
          Remaining:{' '}
          <Text
            style={[
              styles.kvValue,
              remaining >= 0 ? styles.green : styles.red,
            ]}
          >
            £{remaining.toFixed(2)}
          </Text>
        </Text>

        {/* Progress bar */}
        <View style={styles.barOuter}>
          <View
            style={[
              styles.barInner,
              {
                width: `${clampedRatio * 100}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>

        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      <Pressable
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backBtnText}>Back to Dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },

  label: { color: '#9CA3AF', marginBottom: 4 },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    marginTop: 4,
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
    marginRight: 6,
  },
  btnGhost: {
    backgroundColor: '#1F2937',
    marginLeft: 6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
  },

  kv: { color: '#9CA3AF', marginTop: 4 },
  kvValue: { color: '#E5E7EB', fontWeight: '700' },
  green: { color: '#34D399' },
  red: { color: '#F87171' },

  barOuter: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: 999,
  },
  statusText: {
    color: '#E5E7EB',
    marginTop: 8,
    fontSize: 13,
  },

  backBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
  },
  backBtnText: { color: '#E5E7EB', fontWeight: '700' },
});
