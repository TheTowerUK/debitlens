// src/screens/HistoryScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

const todayISO = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');
const addDays = (d, delta) => {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
};
const weekStart = (d) => {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Mon-based week
  x.setDate(x.getDate() - diff);
  return x;
};
const toISO = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PRESETS = ['This week', 'This month', 'Last month', 'This year', 'All time'];

export default function HistoryScreen({ navigation }) {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const accounts = state?.accounts ?? [];
  const allTxns = state?.transactions ?? [];

  // ------- Filters -------
  const [type, setType] = useState('all'); // all | expense | income
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState('This month');
  const [start, setStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [end, setEnd] = useState(todayISO());
  const [accountId, setAccountId] = useState(null); // null = all

  // Derive account lookup
  const byAccount = useMemo(() => {
    const m = {};
    for (const a of accounts) m[String(a.id)] = a;
    return m;
  }, [accounts]);

  // Apply preset -> start/end
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

  // Cycle account picker (simple, no modal)
  const cycleAccount = () => {
    if (!accounts.length) return;
    if (accountId == null) return setAccountId(String(accounts[0].id));
    const ids = accounts.map((a) => String(a.id));
    const i = ids.indexOf(String(accountId));
    setAccountId(i === -1 || i === ids.length - 1 ? null : ids[i + 1]); // go to "all" after last
  };

  // ------- Filtered list -------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const s = (start || '').trim();
    const e = (end || '').trim();
    return allTxns
      .filter((t) => {
        if (type !== 'all' && t.type !== type) return false;
        if (accountId != null && String(t.accountId) !== String(accountId)) return false;

        // date range (inclusive)
        const d = t.date || '';
        if (s && d < s) return false;
        if (e && d > e) return false;

        if (q) {
          const hay =
            `${t.category || ''} ${t.note || ''} ${byAccount[t.accountId]?.name || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [allTxns, type, accountId, start, end, query, byAccount]);

  const totals = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const t of filtered) {
      const v = Number(t.amount || 0);
      if (t.type === 'income') inc += v;
      else exp += v;
    }
    return { inc, exp, net: inc - exp };
  }, [filtered]);

  const onDelete = (id) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => actions.deleteTransaction(id),
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <Text style={styles.h1}>History</Text>
      <Text style={styles.subtle}>Browse, filter and edit transactions</Text>

      {/* Filters */}
      <View style={styles.card}>
        {/* Type pills */}
        <View style={styles.row}>
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

        {/* Presets */}
        <View style={[styles.row, { marginTop: 8 }]}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              style={[styles.pillSm, preset === p && styles.pillActive]}
              onPress={() => applyPreset(p)}
            >
              <Text style={[styles.pillTextSm, preset === p && styles.pillTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* Date inputs */}
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

        {/* Search + Account cycler */}
        <View style={[styles.row, { marginTop: 8 }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search category, note or account"
            placeholderTextColor="#6B7280"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <Pressable style={styles.accountBtn} onPress={cycleAccount}>
            <Text style={styles.accountBtnText}>
              {accountId == null
                ? 'All accounts'
                : byAccount[accountId]?.name || 'Account'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Totals */}
      <View style={[styles.card, { paddingVertical: 12 }]}>
        <View style={styles.rowBetween}>
          <Text style={styles.totLabel}>Income</Text>
          <Text style={[styles.totVal, styles.green]}>{money(totals.inc, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.totLabel}>Expenses</Text>
          <Text style={[styles.totVal, styles.red]}>{money(totals.exp, prefs)}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 4 }]}>
          <Text style={styles.totLabel}>Net</Text>
          <Text
            style={[
              styles.totVal,
              totals.net >= 0 ? styles.green : styles.red,
            ]}
          >
            {money(totals.net, prefs)}
          </Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item, index) =>
          String(item.id ?? `${item.accountId}-${item.date}-${index}`)
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const isExpense = item.type === 'expense';
          const sign = isExpense ? '-' : '+';
          return (
            <Pressable
              style={styles.rowItem}
              onPress={() => navigation.navigate('TxnEditor', { mode: 'edit', txnId: item.id })}
              onLongPress={() => onDelete(item.id)}
            >
              {/* LEFT */}
              <View style={styles.itemLeftWrap}>
                <Text style={styles.itemTop} numberOfLines={1} ellipsizeMode="tail">
                  {(item.category || '—') + (item.note ? ` • ${item.note}` : '')}
                </Text>
                <Text style={styles.itemSub} numberOfLines={1} ellipsizeMode="tail">
                  {(byAccount[item.accountId]?.name || item.accountName || 'Account') + ' • ' + (item.date || '')}
                </Text>
              </View>

              {/* RIGHT */}
              <Text style={[styles.amount, isExpense ? styles.red : styles.green]}>
                {sign}{money(item.amount, prefs)}
              </Text>
            </Pressable>
          );
        }}

        ListEmptyComponent={
          <Text style={[styles.subtle, { padding: 16 }]}>
            No transactions match the current filters.
          </Text>
        }
      />
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
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  // Cards / rows
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemTitle: {
      color: '#E5E7EB',
      fontWeight: '800',
      fontSize: 16,
      flex: 1,       // 👈 take remaining width
      minWidth: 0,   // 👈 allow ellipsis
      paddingRight: 8,
    },
    itemRight: {
      color: '#E5E7EB',
      fontWeight: '800',
      flexShrink: 0, // 👈 don’t shrink
    },
    rowWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap', // 👈 buttons wrap to next line
      marginTop: 10,
      marginRight: -8,
      marginBottom: -8,
    },
    btnTiny: {
      backgroundColor: '#374151',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginRight: 8,
      marginBottom: 8, // 👈 gives space when wrapped
    },
    btnTinyDanger: {
      backgroundColor: '#7F1D1D',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 8,
    },


  // Inputs / buttons
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
  },
  pillSm: {
    backgroundColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginRight: 8,
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

  // Totals
  totLabel: { color: '#9CA3AF', fontWeight: '700' },
  totVal: { color: '#E5E7EB', fontWeight: '800' },
  red: { color: '#F87171' },
  green: { color: '#34D399' },

  // List rows
  rowItem: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLeftWrap: {
    flex: 1,
    minWidth: 0,      // 👈 allows text truncation instead of overflow
    paddingRight: 8,
  },
  itemTop: { color: '#E5E7EB', fontWeight: '700' },
  itemSub: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },
  amount: {
    fontWeight: '800',
    flexShrink: 0,     // 👈 amount never shrinks, stays visible
  },

});
