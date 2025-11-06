// src/screens/BudgetsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Budgets'>;

const BUDGETS_KEY = 'debitlens_budgets_v1';
const LEGACY_BUDGET_KEY = 'debitlens_budget_v1';

type BudgetMap = Record<string, number>;

export default function BudgetsScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [budgets, setBudgets] = useState<BudgetMap>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load budgets (per account) from SecureStore
  useEffect(() => {
    (async () => {
      try {
        let map: BudgetMap = {};

        const json = await SecureStore.getItemAsync(BUDGETS_KEY);
        if (json) {
          try {
            const parsed = JSON.parse(json);
            if (parsed && typeof parsed === 'object') {
              map = parsed;
            }
          } catch (e) {
            console.warn('[budgets] parse budgets failed', e);
          }
        } else {
          // Legacy: if we have the old single budget, map it to first account
          const legacy = await SecureStore.getItemAsync(LEGACY_BUDGET_KEY);
          if (legacy && accounts.length > 0) {
            const n = parseFloat(legacy);
            if (Number.isFinite(n) && n > 0) {
              map[accounts[0].id] = n;
            }
          }
        }

        setBudgets(map);

        // Default selection: first account, or one with a budget
        let initialId: string | null = null;
        if (accounts.length > 0) {
          // Try to pick the first account that has a budget
          const withBudget = accounts.find(a => map[a.id] != null);
          initialId = withBudget?.id ?? accounts[0].id;
        }
        setSelectedAccountId(initialId);

        if (initialId && map[initialId] != null) {
          setAmountText(String(map[initialId]));
        } else {
          setAmountText('');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [accounts.length]);

  // Whenever selectedAccountId or budgets change, sync amountText
  useEffect(() => {
    if (!selectedAccountId) return;
    const current = budgets[selectedAccountId];
    setAmountText(current != null ? String(current) : '');
  }, [selectedAccountId, budgets]);

  const currentAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  // Compute this month’s spend for the selected account
  const { monthLabel, spendThisMonth } = useMemo(() => {
    if (!selectedAccountId) {
      return { monthLabel: '', spendThisMonth: 0 };
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    let spend = 0;
    for (const t of txs) {
      if (t.accountId !== selectedAccountId) continue;
      if (t.type === 'income') continue;
      const d = new Date(t.date || '');
      if (
        !isNaN(d.getTime()) &&
        d.getFullYear() === year &&
        d.getMonth() === month
      ) {
        spend += t.amount;
      }
    }

    const label = now.toLocaleString(undefined, {
      month: 'short',
      year: 'numeric',
    });

    return { monthLabel: label, spendThisMonth: spend };
  }, [txs, selectedAccountId]);

  const currentBudget = selectedAccountId ? budgets[selectedAccountId] ?? null : null;

  const onSave = async () => {
    if (!selectedAccountId) {
      Alert.alert('No account', 'Please pick an account first.');
      return;
    }
    const n = parseFloat(amountText.trim());
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number for the budget.');
      return;
    }
    try {
      setSaving(true);
      const next: BudgetMap = { ...budgets, [selectedAccountId]: n };
      await SecureStore.setItemAsync(BUDGETS_KEY, JSON.stringify(next));
      setBudgets(next);
      Alert.alert('Saved', 'Budget updated for this account.');
    } catch (e) {
      console.warn('[budgets] save failed', e);
      Alert.alert('Error', 'Could not save the budget.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>Loading budgets…</Text>
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>You have no accounts yet.</Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.btnText}>Go to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>
        Set a monthly budget per account. We’ll track how much you’ve spent
        this month from that account.
      </Text>

      {/* Account selector */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.pillRow}>
          {accounts.map(a => (
            <Pressable
              key={a.id}
              onPress={() => setSelectedAccountId(a.id)}
              style={[
                styles.pill,
                selectedAccountId === a.id && styles.pillActive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selectedAccountId === a.id && styles.pillTextActive,
                ]}
              >
                {a.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Budget editor */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Monthly budget{currentAccount ? ` for ${currentAccount.name}` : ''}
        </Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="e.g. 500"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />

        <Pressable
          style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save budget'}</Text>
        </Pressable>

        {currentBudget != null && (
          <Text style={[styles.subtle, { marginTop: 8 }]}>
            Current budget: £{currentBudget.toFixed(0)} per month
          </Text>
        )}
      </View>

      {/* This-month progress */}
      {currentAccount && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>This month’s spend</Text>
          <Text style={styles.kvLabel}>
            {monthLabel} · {currentAccount.name}
          </Text>
          <Text style={styles.kvValue}>
            Spent: £{spendThisMonth.toFixed(2)}
          </Text>
          {currentBudget != null && (
            <Text style={styles.kvValue}>
              Remaining: £{Math.max(currentBudget - spendThisMonth, 0).toFixed(2)}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  center: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  pillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#F9FAFB',
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#F9FAFB',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  kvLabel: {
    color: '#9CA3AF',
    marginBottom: 4,
  },
  kvValue: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
});
