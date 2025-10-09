// src/screens/HistoryScreen.js
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList, Pressable, Alert, Platform
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';
import { toCSV } from '../utils/csv';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export default function HistoryScreen({ navigation }) {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const accounts = state?.accounts || [];
  const txns = state?.transactions || [];

  // -------- Filters --------
  const [accountId, setAccountId] = useState(null);       // null => all
  const [type, setType] = useState('all');                // all | expense | income
  const [startDate, setStartDate] = useState('');         // YYYY-MM-DD
  const [endDate, setEndDate] = useState(todayISO());
  const [query, setQuery] = useState('');                 // match category/note

  const byAccount = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...txns]
      .filter((t) => (accountId ? t.accountId === accountId : true))
      .filter((t) => (type === 'all' ? true : t.type === type))
      .filter((t) => (startDate && isISO(startDate) ? t.date >= startDate : true))
      .filter((t) => (endDate && isISO(endDate) ? t.date <= endDate : true))
      .filter((t) => {
        if (!q) return true;
        const blob = `${t.category || ''} ${t.note || ''}`.toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  }, [txns, accountId, type, startDate, endDate, query]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += Number(t.amount || 0);
      else expense += Number(t.amount || 0);
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  const cycleAccount = () => {
    if (!accounts.length) return;
    if (!accountId) return setAccountId(accounts[0].id);
    const ids = accounts.map((a) => a.id);
    const idx = ids.indexOf(accountId);
    setAccountId(idx === -1 || idx === ids.length - 1 ? null : ids[idx + 1]);
  };

  const accountLabel = accountId ? (byAccount[accountId]?.name || 'Account') : 'All Accounts';

  const exportCSV = async () => {
    try {
      if (!filtered.length) return Alert.alert('Export', 'No transactions match the current filters.');
      const rows = filtered.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        account: t.accountName || byAccount[t.accountId]?.name || '',
        category: t.category || '',
        note: t.note || '',
        amount: Number(t.amount || 0).toFixed(2),
      }));
      const csv = toCSV(rows);
      const fname = `base44-history-${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.csv`;
      const uri = FileSystem.cacheDirectory + fname;
      await FileSystem.writeAsStringAsync(uri, csv);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export filtered transactions',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exported', `Saved to cache:\n${uri}`);
      }
    } catch (e) {
      console.warn('[history] export failed', e);
      Alert.alert('Export failed', String(e?.message || e));
    }
  };

  const onDelete = (id) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await actions.deleteTransaction(id); } },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>History</Text>
      <Text style={styles.subtle}>Filter, review, and export</Text>

      {/* Filters */}
      <View style={styles.card}>
        {/* Type */}
        <View style={styles.row}>
          <Pressable style={[styles.pill, type === 'all' && styles.pillActive]} onPress={() => setType('all')}>
            <Text style={[styles.pillText, type === 'all' && styles.pillTextActive]}>All</Text>
          </Pressable>
          <Pressable style={[styles.pill, type === 'expense' && styles.pillActive]} onPress={() => setType('expense')}>
            <Text style={[styles.pillText, type === 'expense' && styles.pillTextActive]}>Expense</Text>
          </Pressable>
          <Pressable style={[styles.pill, type === 'income' && styles.pillActive]} onPress={() => setType('income')}>
            <Text style={[styles.pillText, type === 'income' && styles.pillTextActive]}>Income</Text>
          </Pressable>
        </View>

        {/* Account */}
        <Pressable style={styles.accountBtn} onPress={cycleAccount}>
          <Text style={styles.accountBtnText}>Account: {accountLabel}</Text>
        </Pressable>

        {/* Dates */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="Start (YYYY-MM-DD)"
              placeholderTextColor="#6B7280"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="End (YYYY-MM-DD)"
              placeholderTextColor="#6B7280"
              style={styles.input}
            />
          </View>
        </View>

        {/* Search */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search category or note"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />

        {/* Actions */}
        <View style={styles.rowBetween}>
          <Pressable
            style={styles.btnSecondary}
            onPress={() => { setAccountId(null); setType('all'); setStartDate(''); setEndDate(todayISO()); setQuery(''); }}
          >
            <Text style={styles.btnText}>Reset</Text>
          </Pressable>
          <Pressable style={styles.btnSave} onPress={exportCSV}>
            <Text style={styles.btnText}>Export CSV</Text>
          </Pressable>
        </View>
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Income</Text>
          <Text style={[styles.amount, styles.green]}>{money(totals.income, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Expenses</Text>
          <Text style={[styles.amount, styles.red]}>{money(totals.expense, prefs)}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 6 }]}>
          <Text style={styles.label}>Net</Text>
          <Text style={[styles.amount, totals.net < 0 ? styles.red : styles.green]}>
            {money(Math.abs(totals.net), prefs)}
          </Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
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
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTop}>
                  {(item.category || '—') + (item.note ? ` • ${item.note}` : '')}
                </Text>
                <Text style={styles.itemSub}>
                  {(byAccount[item.accountId]?.name || item.accountName || 'Account') + ' • ' + item.date}
                </Text>
              </View>
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
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16, paddingTop: Platform.OS === 'ios' ? 44 : 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },

  // Filters
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },

  pill: { backgroundColor: '#1F2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { color: '#fff', fontWeight: '700' },
  pillTextActive: { color: '#fff' },

  accountBtn: { backgroundColor: '#1F2937', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
  accountBtnText: { color: '#fff', fontWeight: '700' },

  input: {
    backgroundColor: '#0F172A', color: '#fff', borderColor: '#1F2937',
    borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8,
  },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#6B7280', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },

  label: { color: '#E5E7EB', fontWeight: '700' },
  amount: { color: '#E5E7EB', fontWeight: '800' },
  red: { color: '#DC2626' },
  green: { color: '#34D399' },

  // List items
  rowItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
  },
  itemTop: { color: '#E5E7EB', fontWeight: '700' },
  itemSub: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },
});
