// src/screens/RecurringScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useApp, type RecurringItem } from '../state/AppContext';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Recurring'>;

function normalizeTitle(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[0-9]/g, '')       // remove digits (often reference numbers)
    .replace(/[^a-z\s]/g, '')    // remove punctuation
    .trim();
}

function inferFrequencyFromIntervals(days: number[]) {
  // very simple heuristic: choose the closest “bucket”
  // (you can tune tolerances later)
  const avg = days.reduce((a, b) => a + b, 0) / (days.length || 1);

  const near = (target: number, tol: number) => Math.abs(avg - target) <= tol;

  if (near(7, 2)) return 'weekly';
  if (near(14, 3)) return 'fortnightly';
  if (near(30, 6)) return 'monthly';
  if (near(365, 30)) return 'yearly';
  return 'monthly';
}

function nextDueDateFromLast(last: Date, freq: string) {
  const d = new Date(last);
  if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'fortnightly') d.setDate(d.getDate() + 14);
  else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // monthly default
  return d.toISOString().slice(0, 10);
}


function formatMoney(v: number) {
  return `£${(Number(v) || 0).toFixed(2)}`;
}

function niceDate(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
}

function cap(s: string) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function RecurringScreen({ navigation }: Props) {
  const { state, actions } = useApp();
  const recurring: RecurringItem[] = state.recurring || [];
  const txs = state.transactions || [];
  const [showDetect, setShowDetect] = useState(false);

  const detectCandidates = useMemo(() => {
    // Only look at expenses (most recurring items are outgoing)
    const expenses = txs.filter((t) => t?.type === 'expense' && t?.date && t?.name);

    // Group by (normalized title + amount)
    const groups: Record<string, { title: string; amount: number; dates: Date[]; category?: string }> = {};

    for (const t of expenses) {
      const title = String(t.name || '').trim();
      const norm = normalizeTitle(title);
      const amt = Math.abs(Number(t.amount) || 0);

      if (!norm || amt <= 0) continue;

      const key = `${norm}__${amt.toFixed(2)}`;

      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;

      if (!groups[key]) {
        groups[key] = { title, amount: amt, dates: [], category: t.category || undefined };
      }
      groups[key].dates.push(d);
    }

    const candidates = Object.values(groups)
      .map((g) => {
        const dates = g.dates.sort((a, b) => a.getTime() - b.getTime());
        if (dates.length < 3) return null; // need at least 3 occurrences to be confident

        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          const diffMs = dates[i].getTime() - dates[i - 1].getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 0) intervals.push(diffDays);
        }
        if (intervals.length < 2) return null;

        const frequency = inferFrequencyFromIntervals(intervals);
        const last = dates[dates.length - 1];
        const nextDueDate = nextDueDateFromLast(last, frequency);

        return {
          title: g.title,
          amount: g.amount,
          category: g.category,
          count: dates.length,
          frequency,
          lastDate: last.toISOString().slice(0, 10),
          nextDueDate,
        };
      })
      .filter(Boolean)
      // show the most “repeat-y” items first
      .sort((a: any, b: any) => (b.count ?? 0) - (a.count ?? 0));

    return candidates as Array<{
      title: string;
      amount: number;
      category?: string;
      count: number;
      frequency: string;
      lastDate: string;
      nextDueDate: string;
    }>;
  }, [txs]);


  const list = useMemo(() => {
    return [...recurring].sort((a, b) => {
      const da = a.nextDueDate ? new Date(a.nextDueDate).getTime() : 0;
      const db = b.nextDueDate ? new Date(b.nextDueDate).getTime() : 0;
      return da - db;
    });
  }, [recurring]);

  const totals = useMemo(() => {
    let activeCount = 0;
    let monthlyApprox = 0;

    // approx “payments per month”
    const multipliers: Record<string, number> = {
      daily: 30,
      weekly: 4,
      fortnightly: 2,
      monthly: 1,
      yearly: 1 / 12,
    };

    for (const r of recurring) {
      if (r.active === false) continue;
      activeCount++;

      const amt = Number(r.amount) || 0;

      // treat as string so we can handle real-world values even if the TS union is narrower
      const freq = String(r.frequency || 'monthly').toLowerCase().trim();

      const mult = multipliers[freq] ?? 1; // default monthly
      monthlyApprox += amt * mult;
    }

    return { activeCount, monthlyApprox };
  }, [recurring]);


  const toggleActive = (item: RecurringItem) => {
    const fn = (actions as any)?.updateRecurring;
    if (typeof fn !== 'function') return;

    fn(item.id, { active: item.active === false ? true : false });
  };

  const confirmDelete = (item: RecurringItem) => {
    const fn = (actions as any)?.deleteRecurring;
    if (typeof fn !== 'function') return;

    Alert.alert(
      'Delete recurring item?',
      'This will remove it permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => fn(item.id) },
      ]
    );
  };

  const goAdd = () => {
    // Only wire if you actually have RecurringEditor in your navigator
    // navigation.navigate('RecurringEditor');
    Alert.alert('Add recurring', 'Hook this to your RecurringEditor when ready.');
  };

  const goEdit = (item: RecurringItem) => {
    // Only wire if you actually have RecurringEditor in your navigator
    // navigation.navigate('RecurringEditor', { id: item.id });
    Alert.alert('Edit recurring', 'Hook this to your RecurringEditor when ready.');
  };

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Recurring</Text>
            <Text style={styles.subtle}>Direct debits & standing orders</Text>
          </View>

          <View style={styles.pillsRow}>
            <Pressable style={styles.headerPill} onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.headerPillText}>Back</Text>
            </Pressable>

            <Pressable style={[styles.headerPill, styles.addPill]} onPress={goAdd} hitSlop={8}>
              <Text style={styles.headerPillText}>Add</Text>
            </Pressable>

            <Pressable
              style={[styles.headerPill, styles.detectPill]}
              onPress={() => setShowDetect((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.headerPillText}>{showDetect ? 'Hide detect' : 'Detect'}</Text>
            </Pressable>
          </View>
        </View>


        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Overview</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Active items</Text>
              <Text style={styles.summaryValue}>{totals.activeCount}</Text>
              <Text style={styles.summarySub}>Excludes paused items</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Monthly estimate</Text>
              <Text style={styles.summaryValue}>{formatMoney(totals.monthlyApprox)}</Text>
              <Text style={styles.summarySub}>Approx. based on frequency</Text>
            </View>
          </View>
        </View>

        {showDetect ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Detect recurring candidates</Text>
            </View>

            {detectCandidates.length === 0 ? (
              <Text style={styles.subtle}>
                No strong recurring patterns found yet (need ~3+ repeats with a consistent interval).
              </Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {detectCandidates.slice(0, 12).map((c, idx) => (
                  <View key={`${c.title}-${c.amount}-${idx}`} style={styles.detectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detectTitle}>{c.title}</Text>
                      <Text style={styles.detectSub}>
                        {c.count} repeats • {String(c.frequency).toUpperCase()} • Last: {c.lastDate}
                      </Text>
                      <Text style={styles.detectSubDim}>
                        Next due: {c.nextDueDate} • {formatMoney(c.amount)}
                      </Text>
                    </View>

                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => {
                        const addFn = (actions as any)?.addRecurring;
                        if (typeof addFn !== 'function') {
                          Alert.alert(
                            'Not wired yet',
                            'addRecurring action is not available yet. Tell me your AppContext actions and I’ll wire it.'
                          );
                          return;
                        }

                        addFn({
                          title: c.title,
                          amount: c.amount,
                          frequency: c.frequency, // weekly/fortnightly/monthly/yearly
                          nextDueDate: c.nextDueDate,
                          active: true,
                          category: c.category,
                        });

                        Alert.alert('Added', 'Recurring item created from detected pattern.');
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.actionBtnText}>Add</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}


        <Pressable
          style={[styles.headerPill, styles.detectPill]}
          onPress={() => setShowDetect((v) => !v)}
          hitSlop={8}
        >
          <Text style={styles.headerPillText}>{showDetect ? 'Hide detect' : 'Detect'}</Text>
        </Pressable>



        {/* List */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Your recurring items</Text>
          </View>

          {list.length === 0 ? (
            <Text style={styles.subtle}>No recurring items yet.</Text>
          ) : (
            <View style={{ marginTop: 6 }}>
              {list.map((item) => {
                const isPaused = item.active === false;
                const title =
                  item.title || (item.isTransfer ? 'Recurring transfer' : 'Recurring item');

                return (
                  <Pressable
                    key={item.id}
                    style={[styles.row, isPaused && styles.rowPaused]}
                    onPress={() => goEdit(item)}
                    hitSlop={6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {title}{' '}
                        {isPaused ? <Text style={styles.pausedTag}> (Paused)</Text> : null}
                      </Text>

                      <Text style={styles.rowSub}>
                        {cap(String(item.frequency || 'monthly'))} • Next due: {niceDate(item.nextDueDate)}
                      </Text>

                      {item.category ? (
                        <Text style={styles.rowSubDim}>Category: {String(item.category)}</Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rowAmt}>{formatMoney(Number(item.amount || 0))}</Text>

                      <View style={styles.rowActions}>
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => toggleActive(item)}
                          hitSlop={8}
                        >
                          <Text style={styles.actionBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
                        </Pressable>

                        <Pressable
                          style={[styles.actionBtn, styles.deleteBtn]}
                          onPress={() => confirmDelete(item)}
                          hitSlop={8}
                        >
                          <Text style={styles.actionBtnText}>Del</Text>
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeWrap: { flex: 1, backgroundColor: theme.bg },
  wrap: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    columnGap: 8,
  },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800' },
  subtle: { color: theme.textDim, marginTop: 4, flexShrink: 1 },

  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  addPill: {
    borderColor: theme.link,
  },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '700' },

  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  summaryTitle: { color: '#E5E7EB', fontWeight: '700', marginBottom: 6, fontSize: 16 },
  summaryRow: { flexDirection: 'row', columnGap: 12 },
  summaryItem: { flex: 1 },
  summaryLabel: { color: theme.textDim, fontSize: 12, marginBottom: 2 },
  summaryValue: { color: theme.text, fontSize: 18, fontWeight: '900' },
  summarySub: { color: theme.textDim, fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  rowPaused: { opacity: 0.75 },

  rowTitle: { color: theme.text, fontWeight: '900' },
  pausedTag: { color: theme.textDim, fontWeight: '800' },

  rowSub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  rowSubDim: { color: theme.textDim, fontSize: 12, marginTop: 4, opacity: 0.8 },

  rowAmt: { color: '#E5E7EB', fontWeight: '900' },

  rowActions: { flexDirection: 'row', columnGap: 8, marginTop: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  deleteBtn: {
    borderColor: '#B91C1C',
  },
  detectPill: {
  borderColor: theme.link,
},

  detectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    columnGap: 10,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    columnGap: 8,
    rowGap: 8, // ✅ the “single space underneath”
  },

  detectTitle: { color: theme.text, fontWeight: '900' },
  detectSub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  detectSubDim: { color: theme.textDim, fontSize: 12, marginTop: 4, opacity: 0.8 },

  actionBtnText: { color: '#E5E7EB', fontWeight: '800', fontSize: 12 },
});
