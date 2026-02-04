// src/screens/RecurringScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useApp, type RecurringItem } from '../state/AppContext';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Recurring'>;

// ---------------- Helpers ----------------
function normalizeTitle(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/\u00A0/g, ' ') // NBSP -> space
    .replace(/\s+/g, ' ')
    .replace(/[0-9]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

function parseTxnDate(value: unknown): Date | null {
  const s = String(value || '').trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD (or YYYY-MM-DDTHH:mm...)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // UK CSV: DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function inferFrequencyFromIntervals(days: number[]) {
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

// Simple clamp
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// Safe amount parser (handles £ and commas)
function parseAmount(value: unknown): number {
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const cleaned = s.replace(/£/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// ---------------- Suggestions persistence ----------------
const DISMISSED_KEY = 'debitlens.recurringSuggestions.dismissed.v1';

async function loadDismissedKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function saveDismissedKeys(keys: string[]) {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

// ---------------- Screen ----------------
export default function RecurringScreen({ navigation }: Props) {
  const { state, actions } = useApp();
  const recurring: RecurringItem[] = state.recurring || [];
  const txs = state.transactions || [];
  const [showDetect, setShowDetect] = useState(false);

  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

  useEffect(() => {
    loadDismissedKeys().then(setDismissedKeys);
  }, []);

  const dismissedSet = useMemo(() => new Set(dismissedKeys), [dismissedKeys]);

  /**
   * Detection expects transactions shaped like:
   * { date, accountId, amount, description, category }
   * Defensive about date formats (ISO or DD/MM/YYYY).
   *
   * IMPORTANT:
   * - We only detect expenses here (amt < 0)
   * - Returned suggestions include accountId so creation is correctly linked
   */
  const detectCandidates = useMemo(() => {
    let debugExpensesCount = 0;
    let debugGroupsCount = 0;

    // ---- Merchant helpers ----
    const STOPWORDS = new Set([
      'ltd',
      'limited',
      'plc',
      'co',
      'company',
      'uk',
      'the',
      'and',
      'of',
      'to',
      'payment',
      'card',
      'visa',
      'mastercard',
      'debit',
      'credit',
      'direct',
      'dd',
      'pos',
      'contactless',
      'online',
      'store',
      'stores',
      'superstore',
      'market',
      'supermarket',
    ]);

    // Merchants we usually DON'T want recurring detection for (too noisy/variable)
    const NOISY_MERCHANT_PATTERNS: RegExp[] = [
      /^amzn/i,
      /^amazon/i,
      /amznmktplace/i,
      /amzn/i,
      /marks\s*&\s*spencer/i,
      /morrison/i,
      /tesco/i,
      /sainsbury/i,
      /asda/i,
      /aldi/i,
      /paypal/i, // often mixed
    ];

    function merchantKeyFromTxn(t: any) {
      const nameRaw = String(t?.name || '').replace(/\u00A0/g, ' ').trim();
      const descRaw = String(t?.description || '').replace(/\u00A0/g, ' ').trim();
      let s = (nameRaw || descRaw || '').trim();
      if (!s) return null;

      s = s.toLowerCase();

      // Strip common reference noise
      s = s
        .replace(/\*[a-z0-9]{3,}/g, ' ') // *32993 / *2o4pz etc
        .replace(/\b\d{3,}[-/]\d{2,}\b/g, ' ') // 353-12477661
        .replace(/\b\d{6,}\b/g, ' ') // long digit sequences
        .replace(/[\(\)\[\]\{\}]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Remove trailing locations (basic)
      s = s
        .replace(/\b(london|st albans|hatfield|bedford|stevenage|uxbridge)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = s
        .split(' ')
        .filter(Boolean)
        .filter((tok) => tok.length >= 2 && !STOPWORDS.has(tok));

      if (tokens.length === 0) return null;

      const key = tokens.slice(0, 5).join(' ');
      return key;
    }

    function isNoisyMerchant(key: string) {
      return NOISY_MERCHANT_PATTERNS.some((re) => re.test(key));
    }

    function amountBucketKey(amountAbs: number) {
      return String(Math.round(amountAbs)); // coarse bucket (e.g., 277)
    }

    // ---- Expenses only, must have date + merchant ----
    function parseAmount(value: unknown): number {
      const s = String(value ?? '').trim();
      if (!s) return 0;
      const cleaned = s.replace(/£/g, '').replace(/,/g, '');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    
    // ---- Expenses only, must have date + merchant ----
    const expenses = txs.filter((t: any) => {
      const amt = parseAmount(t?.amount);
      const isExpense = String(t?.type || '').toLowerCase() === 'expense';
      const d = parseTxnDate(t?.date);
      const key = merchantKeyFromTxn(t);
    
      const ok = (amt < 0 || isExpense) && !!d && !!key;
      if (ok) debugExpensesCount += 1;
      return ok;
    });
    

    type Group = {
      merchantKey: string;
      displayTitle: string;
      category?: string;
      dates: Date[];
      amounts: number[];
      sumAmount: number;
      count: number;
      suggestionKey: string; // stable key for dismissal
      accountId: string;
    };

    const groups: Record<string, Group> = {};

    for (const t of expenses) {
      const merchantKey = merchantKeyFromTxn(t);
      if (!merchantKey) continue;
      if (isNoisyMerchant(merchantKey)) continue;

      const amtAbs = Math.abs(parseAmount(t?.amount));
      if (!(amtAbs > 0)) continue;

      const d = parseTxnDate(t?.date);
      if (!d) continue;

      const accountId = String(t?.accountId || '').trim();
      if (!accountId) continue;

      const bucket = amountBucketKey(amtAbs);

      // Stable suggestion key used for Dismiss + also for "already created" filtering
      const suggestionKey = `${accountId}__${merchantKey}__${bucket}`;

      const key = `${merchantKey}__${bucket}__${accountId}`;

      if (!groups[key]) {
        debugGroupsCount += 1;

        const displayTitle = String(t?.description || '').trim() || merchantKey;

        groups[key] = {
          merchantKey,
          displayTitle,
          category: String(t?.category || '').trim() || undefined,
          dates: [],
          amounts: [],
          sumAmount: 0,
          count: 0,
          suggestionKey,
          accountId,
        };
      }

      groups[key].dates.push(d);
      groups[key].amounts.push(amtAbs);
      groups[key].sumAmount += amtAbs;
      groups[key].count += 1;
    }

    const TOLERANCE_PCT = 0.03; // ±3%

    const candidates = Object.values(groups)
      .map((g) => {
        const dates = g.dates.sort((a, b) => a.getTime() - b.getTime());
        if (dates.length < 2) return null;

        const avgAmount = g.count ? g.sumAmount / g.count : 0;
        if (!(avgAmount > 0)) return null;

        const maxAllowedDiff = avgAmount * TOLERANCE_PCT;
        const withinTol = g.amounts.every((a) => Math.abs(a - avgAmount) <= Math.max(0.75, maxAllowedDiff));
        if (!withinTol) return null;

        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
          const diffMs = dates[i].getTime() - dates[i - 1].getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > 0) intervals.push(diffDays);
        }
        if (intervals.length < 1) return null;

        const frequency = inferFrequencyFromIntervals(intervals);
        const last = dates[dates.length - 1];
        const nextDueDate = nextDueDateFromLast(last, frequency);

        // Confidence:
        // - more repeats = better
        // - tighter interval variance = better
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance =
          intervals.reduce((sum, x) => sum + Math.abs(x - avgInterval), 0) / intervals.length;

        const repeatsScore = clamp01((dates.length - 2) / 6); // 2->0, 8->1
        const varianceScore = clamp01(1 - variance / Math.max(1, avgInterval)); // 1 best
        const confidence = clamp01(0.55 * varianceScore + 0.45 * repeatsScore);

        return {
          suggestionKey: g.suggestionKey,
          accountId: g.accountId,
          title: g.displayTitle,
          merchantKey: g.merchantKey,
          amount: avgAmount,
          category: g.category,
          count: dates.length,
          frequency,
          lastDate: last.toISOString().slice(0, 10),
          nextDueDate,
          confidence,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if ((b.confidence ?? 0) !== (a.confidence ?? 0)) return (b.confidence ?? 0) - (a.confidence ?? 0);
        return (b.count ?? 0) - (a.count ?? 0);
      }) as Array<{
      suggestionKey: string;
      accountId: string;
      title: string;
      merchantKey: string;
      amount: number;
      category?: string;
      count: number;
      frequency: string;
      lastDate: string;
      nextDueDate: string;
      confidence: number;
    }>;

    (candidates as any)._debug = { expenses: debugExpensesCount, groups: debugGroupsCount };
    return candidates;
  }, [txs]);

  // Filter out dismissed + filter out already-existing recurring by title+amount(+accountId)
  const suggestions = useMemo(() => {
    const existing = recurring
      .map((r) => ({
        t: normalizeTitle((r as any).title || ''),
        amt: Math.round(Math.abs(Number((r as any).amount || 0)) * 100) / 100,
        acc: String((r as any).accountId || ''),
      }))
      .filter((x) => x.t);

    const isAlreadyRecurring = (title: string, amount: number, accountId: string) => {
      const t = normalizeTitle(title);
      const a = Math.round(Math.abs(amount) * 100) / 100;
      return existing.some((e) => e.t === t && e.acc === accountId && Math.abs(e.amt - a) <= 0.5);
    };

    return detectCandidates
      .filter((c) => !dismissedSet.has(c.suggestionKey))
      .filter((c) => !isAlreadyRecurring(c.title, c.amount, c.accountId))
      .filter((c) => (c.confidence ?? 0) >= 0.55);
  }, [detectCandidates, dismissedSet, recurring]);

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

      const amt = parseAmount((r as any).amount);
      const freq = String((r as any).frequency || 'monthly').toLowerCase().trim();
      const mult = multipliers[freq] ?? 1;

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

    Alert.alert('Delete recurring item?', 'This will remove it permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => fn(item.id) },
    ]);
  };

  const goAdd = () => {
    Alert.alert('Add recurring', 'Hook this to your RecurringEditor when ready.');
  };

  const goEdit = (item: RecurringItem) => {
    Alert.alert('Edit recurring', 'Hook this to your RecurringEditor when ready.');
  };

  const dismissSuggestion = async (suggestionKey: string) => {
    const next = Array.from(new Set([...dismissedKeys, suggestionKey]));
    setDismissedKeys(next);
    await saveDismissedKeys(next);
  };

  const createFromSuggestion = (c: any) => {
    const addFn = (actions as any)?.addRecurring;

    if (typeof addFn !== 'function') {
      Alert.alert('Not wired yet', 'addRecurring action is not available yet.');
      return;
    }

    Alert.alert(
      'Create recurring item?',
      `Create "${c.title}" as ${cap(String(c.frequency))} for ${formatMoney(c.amount)}?\n\nNext due: ${c.nextDueDate}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          style: 'default',
          onPress: async () => {
            // IMPORTANT: RecurringItem requires type + (optional but recommended) accountId
            addFn({
              title: c.title,
              active: true,
              nextDueDate: c.nextDueDate,
              frequency: c.frequency,
              amount: Math.abs(parseAmount(c.amount)),
              type: 'expense', // detector is expenses-only
              accountId: c.accountId,
              category: c.category,
              description: c.title,
            });

            // Hide this suggestion going forward
            await dismissSuggestion(c.suggestionKey);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* Subtitle */}
        <View style={styles.subtitleRow}>
          <Text style={styles.subtle}>Direct debits & standing orders</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable style={[styles.headerPill, styles.addPill]} onPress={goAdd} hitSlop={8}>
            <Text style={styles.headerPillText}>Add</Text>
          </Pressable>

          <Pressable
            style={[styles.headerPill, styles.detectPill]}
            onPress={() => setShowDetect((v) => !v)}
            hitSlop={8}
          >
            <Text style={[styles.headerPillText, styles.detectPillText]}>
              {showDetect ? 'Hide suggestions' : 'Suggestions'}
            </Text>
          </Pressable>
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

        {/* Suggestions panel */}
        {showDetect ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Recurring suggestions</Text>
            </View>

            {(detectCandidates as any)._debug ? (
              <Text style={[styles.subtle, { marginBottom: 8 }]}>
                Debug · Expenses considered: {(detectCandidates as any)._debug.expenses} · Groups built:{' '}
                {(detectCandidates as any)._debug.groups}
              </Text>
            ) : null}

            {suggestions.length === 0 ? (
              <Text style={styles.subtle}>
                No strong patterns found (or they've already been dismissed / created). Import more history or wait for
                repeats.
              </Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                {suggestions.slice(0, 12).map((c, idx) => (
                  <View key={`${c.suggestionKey}-${idx}`} style={styles.detectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detectTitle}>{c.title}</Text>
                      <Text style={styles.detectSub}>
                        {c.count} repeats • {String(c.frequency).toUpperCase()} • Last: {c.lastDate}
                      </Text>
                      <Text style={styles.detectSubDim}>
                        Next due: {c.nextDueDate} • {formatMoney(c.amount)} • Confidence:{' '}
                        {Math.round((c.confidence || 0) * 100)}%
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', columnGap: 8 }}>
                      <Pressable style={styles.actionBtn} onPress={() => createFromSuggestion(c)} hitSlop={8}>
                        <Text style={styles.actionBtnText}>Create</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.actionBtn, styles.dismissBtn]}
                        onPress={() => dismissSuggestion(c.suggestionKey)}
                        hitSlop={8}
                      >
                        <Text style={styles.actionBtnText}>Dismiss</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* Existing recurring list */}
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
                const hasBoth = !!(item.fromAccountId && item.toAccountId);
                const hasOne = !!(item.fromAccountId || item.toAccountId) && !hasBoth;
                const title =
                  item.title ||
                  (hasBoth ? 'Recurring transfer' : hasOne ? 'Recurring transfer (incomplete)' : 'Recurring item');

                return (
                  <Pressable
                    key={item.id}
                    style={[styles.row, isPaused && styles.rowPaused]}
                    onPress={() => goEdit(item)}
                    hitSlop={6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {title} {isPaused ? <Text style={styles.pausedTag}> (Paused)</Text> : null}
                      </Text>

                      <Text style={styles.rowSub}>
                        {cap(String((item as any).frequency || 'monthly'))} • Next due:{' '}
                        {niceDate((item as any).nextDueDate)}
                      </Text>

                      {(item as any).category ? (
                        <Text style={styles.rowSubDim}>Category: {String((item as any).category)}</Text>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rowAmt}>{formatMoney(Number((item as any).amount || 0))}</Text>

                      <View style={styles.rowActions}>
                        <Pressable style={styles.actionBtn} onPress={() => toggleActive(item)} hitSlop={8}>
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

  subtitleRow: { marginBottom: 12 },
  subtle: { color: theme.textDim, marginTop: 4, flexShrink: 1 },

  actionRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 16,
  },

  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  addPill: { borderColor: theme.link },

  detectPill: {
    backgroundColor: theme.cardAlt,
    borderColor: theme.link,
  },

  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '700' },
  detectPillText: { color: theme.link },

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
  deleteBtn: { borderColor: '#B91C1C' },
  dismissBtn: { borderColor: theme.textDim },
  actionBtnText: { color: '#E5E7EB', fontWeight: '800', fontSize: 12 },

  detectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    columnGap: 10,
  },
  detectTitle: { color: theme.text, fontWeight: '900' },
  detectSub: { color: theme.textDim, fontSize: 12, marginTop: 4 },
  detectSubDim: { color: theme.textDim, fontSize: 12, marginTop: 4, opacity: 0.8 },
});
