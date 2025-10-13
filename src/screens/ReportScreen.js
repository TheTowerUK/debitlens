// src/screens/ReportScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

// --- date helpers ---
const pad = (n) => String(n).padStart(2, '0');
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const weekStart = (d) => {
  const x = new Date(d);
  const dow = x.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // make Monday=0
  x.setDate(x.getDate() - diff);
  return x;
};
const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PRESETS = ['This week', 'This month', 'Last month', 'This year', 'All time'];

export default function ReportScreen() {
  const { state } = useApp();
  const prefs = state?.prefs || {};
  const accounts = state?.accounts ?? [];
  const txns = state?.transactions ?? [];

  // ---------- Filters ----------
  const [type, setType] = useState('all'); // all | expense | income
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState('This month');
  const [start, setStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [end, setEnd] = useState(todayISO());
  const [accountId, setAccountId] = useState(null); // null => all accounts

  const byAccount = useMemo(() => {
    const m = {};
    for (const a of accounts) m[String(a.id)] = a;
    return m;
  }, [accounts]);

  const applyPreset = (name) => {
    const now = new Date();
    if (name === 'This week') {
      const ws = weekStart(now);
      setStart(toISO(ws));
      setEnd(toISO(now));
    } else if (name === 'This month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      setStart(toISO(s));
      setEnd(toISO(now));
    } else if (name === 'Last month') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      setStart(toISO(s));
      setEnd(toISO(e));
    } else if (name === 'This year') {
      const s = new Date(now.getFullYear(), 0, 1);
      setStart(toISO(s));
      setEnd(toISO(now));
    } else {
      // All time
      setStart('');
      setEnd('');
    }
    setPreset(name);
  };

  const cycleAccount = () => {
    if (!accounts.length) return;
    if (accountId == null) return setAccountId(String(accounts[0].id));
    const ids = accounts.map((a) => String(a.id));
    const i = ids.indexOf(String(accountId));
    setAccountId(i === -1 || i === ids.length - 1 ? null : ids[i + 1]); // next, then back to "all"
  };

  // ---------- Filtered base list ----------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const s = (start || '').trim();
    const e = (end || '').trim();

    return (txns || [])
      .filter((t) => {
        if (type !== 'all' && t.type !== type) return false;
        if (accountId != null && String(t.accountId) !== String(accountId)) return false;

        const d = t.date || '';
        if (s && d < s) return false;
        if (e && d > e) return false;

        if (q) {
          const hay = `${t.category || ''} ${t.note || ''} ${byAccount[t.accountId]?.name || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [txns, type, accountId, start, end, query, byAccount]);

  // ---------- Totals ----------
  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of filtered) {
      const v = Number(t.amount || 0);
      if (t.type === 'income') inc += v;
      else exp += v;
    }
    return { inc, exp, net: inc - exp };
  }, [filtered]);

  // ---------- Category roll-up ----------
  const categoryRows = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const cat = (t.category || (t.type === 'income' ? 'Income' : 'General')).trim();
      const row = map.get(cat) || { id: cat, category: cat, income: 0, expense: 0, net: 0 };
      const v = Number(t.amount || 0);
      if (t.type === 'income') {
        row.income += v;
        row.net += v;
      } else {
        row.expense += v;
        row.net -= v;
      }
      map.set(cat, row);
    }
    return Array.from(map.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [filtered]);

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>Filter and view category roll-ups</Text>

      {/* Filters card */}
      <View style={styles.card}>
        {/* Type (wrap) */}
        <View style={styles.rowWrap}>
          {['all', 'expense', 'income'].map((t) => (
            <Pressable
              key={t}
              style={[styles.pill, type === t && styles.pillActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.pillText, type === t && styles.pillTextActive]}>
                {t[0].toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Presets (wrap) */}
        <View style={[styles.rowWrap, { marginTop: 8 }]}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              style={[styles.pillSm, preset === p && styles.pillActive]}
              onPress={() => applyPreset(p)}
            >
              <Text style={[styles.pillTextSm, preset === p && styles.pillTextActive]} numberOfLines={1}>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Dates */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <TextInput
            value={start}
            onChangeText={setStart}
            placeholder="Start YYYY-MM-DD"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            value={end}
            onChangeText={setEnd}
            placeholder="End YYYY-MM-DD"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1 }]}
          />
        </View>

        {/* Search + account cycler */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search category, note or account"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <Pressable style={styles.accountBtn} onPress={cycleAccount}>
            <Text style={styles.accountBtnText} numberOfLines={1}>
              {accountId == null ? 'All accounts' : (byAccount[accountId]?.name || 'Account')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Totals */}
      <View style={[styles.card, { paddingVertical: 12 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.totLabel}>Income</Text>
          <Text style={[styles.totVal, styles.green]} numberOfLines={1}>
            {money(totals.inc, prefs)}
          </Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.totLabel}>Expenses</Text>
          <Text style={[styles.totVal, styles.red]} numberOfLines={1}>
            {money(totals.exp, prefs)}
          </Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 4 }]}>
          <Text style={styles.totLabel}>Net</Text>
          <Text style={[styles.totVal, totals.net >= 0 ? styles.green : styles.red]} numberOfLines={1}>
            {money(totals.net, prefs)}
          </Text>
        </View>
      </View>

      {/* Category Roll-up */}
      <View style={styles.card}>
        <Text style={[styles.h2, { marginBottom: 8 }]}>By Category</Text>

        <FlatList
          data={categoryRows}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <Text style={[styles.subtle, { paddingVertical: 8 }]}>
              No data for current filters.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.rowBetween}>
              <View style={styles.leftClamp}>
                <Text style={styles.itemTop} numberOfLines={1} ellipsizeMode="tail">
                  {item.category}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1} ellipsizeMode="tail">
                  +{money(item.income, prefs)} / -{money(item.expense, prefs)}
                </Text>
              </View>
              <Text style={[styles.amount, item.net >= 0 ? styles.green : styles.red]} numberOfLines={1}>
                {item.net >= 0 ? '+' : '-'}
                {money(Math.abs(item.net), prefs)}
              </Text>
            </View>
          )}
        />
      </View>
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
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  h2: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // NEW: wrap rows for pills
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginRight: -8,
    marginBottom: -8,
  },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },

  pill: {
    backgroundColor: '#1F2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8, // allow clean wrap
  },
  pillSm: {
    backgroundColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8, // allow clean wrap
  },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextSm: { color: '#E5E7EB', fontWeight: '700', fontSize: 12 },
  pillTextActive: { color: '#fff' },

  accountBtn: {
    backgroundColor: '#1F2937',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  accountBtnText: { color: '#fff', fontWeight: '700' },

  totLabel: { color: '#9CA3AF', fontWeight: '700' },
  totVal: { color: '#E5E7EB', fontWeight: '800', flexShrink: 0 },

  // Clamp left column in list rows; keep right-side amount visible
  leftClamp: { flex: 1, minWidth: 0, paddingRight: 8 },
  itemTop: { color: '#E5E7EB', fontWeight: '700' },
  itemSub: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },
  amount: { color: '#E5E7EB', fontWeight: '800', flexShrink: 0 },

  red: { color: '#F87171' },
  green: { color: '#34D399' },
});
