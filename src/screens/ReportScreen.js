// src/screens/ReportScreen.js
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable, Platform, Alert
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';
import { toCSV } from '../utils/csv';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const ym = (isoDate) => (isoDate || '').slice(0, 7); // YYYY-MM

export default function ReportScreen() {
  const { state } = useApp();
  const prefs = state?.prefs || {};
  const accounts = state?.accounts || [];
  const txns = state?.transactions || [];

  // -------- Filters (same shape/behavior as History) --------
  const [accountId, setAccountId] = useState(null); // null => all
  const [type, setType] = useState('all');          // all | expense | income
  const [startDate, setStartDate] = useState('');   // YYYY-MM-DD
  const [endDate, setEndDate] = useState(todayISO());
  const [query, setQuery] = useState('');           // match category/note

  const byAccount = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // -------- Apply filters --------
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
      .sort((a, b) => a.date.localeCompare(b.date)); // oldest -> newest for rollups
  }, [txns, accountId, type, startDate, endDate, query]);

  // -------- Rollups + Top categories + Monthly averages --------
  const rollups = useMemo(() => {
    const byMonth = {};
    const byCategory = {};
    let income = 0, expense = 0;

    for (const t of filtered) {
      const m = ym(t.date);
      const amt = Number(t.amount || 0);

      // Month
      if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0, net: 0 };
      if (t.type === 'income') { byMonth[m].income += amt; income += amt; }
      else { byMonth[m].expense += amt; expense += amt; }
      byMonth[m].net = byMonth[m].income - byMonth[m].expense;

      // Category
      const cat = (t.category || 'Uncategorized').trim();
      if (!byCategory[cat]) byCategory[cat] = { income: 0, expense: 0, net: 0 };
      if (t.type === 'income') byCategory[cat].income += amt;
      else byCategory[cat].expense += amt;
      byCategory[cat].net = byCategory[cat].income - byCategory[cat].expense;
    }

    const totals = { income, expense, net: income - expense };

    // Sorted lists
    const months = Object.keys(byMonth).sort(); // YYYY-MM asc
    const categoriesByAbsNet = Object.entries(byCategory)
      .sort(([, a], [, b]) => Math.abs(b.net) - Math.abs(a.net));

    // Top expense categories (largest expense)
    const topExpenses = Object.entries(byCategory)
      .filter(([, v]) => v.expense > 0)
      .sort(([, a], [, b]) => b.expense - a.expense)
      .slice(0, 5);

    // Monthly averages across the months present in filtered data
    const monthCount = months.length || 1;
    const monthlyAvg = {
      income: income / monthCount,
      expense: expense / monthCount,
      net: (income - expense) / monthCount,
      monthCount,
    };

    return { byMonth, byCategory, months, categoriesByAbsNet, totals, topExpenses, monthlyAvg };
  }, [filtered]);

  const cycleAccount = () => {
    if (!accounts.length) return;
    if (!accountId) return setAccountId(accounts[0].id);
    const ids = accounts.map((a) => a.id);
    const idx = ids.indexOf(accountId);
    setAccountId(idx === -1 || idx === ids.length - 1 ? null : ids[idx + 1]);
  };
  const accountLabel = accountId ? (byAccount[accountId]?.name || 'Account') : 'All Accounts';

  // -------- CSV Export (current filters + rollups + extras) --------
  const exportCSV = async () => {
    try {
      // Sheet 1: transactions (filtered)
      const rowsTx = filtered.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        account: t.accountName || byAccount[t.accountId]?.name || '',
        category: t.category || '',
        note: t.note || '',
        amount: Number(t.amount || 0).toFixed(2),
      }));

      // Sheet 2: month rollup
      const rowsMonth = rollups.months.map((m) => ({
        month: m,
        income: Number(rollups.byMonth[m].income || 0).toFixed(2),
        expense: Number(rollups.byMonth[m].expense || 0).toFixed(2),
        net: Number(rollups.byMonth[m].net || 0).toFixed(2),
      }));

      // Sheet 3: category rollup (sorted by absolute net)
      const rowsCat = rollups.categoriesByAbsNet.map(([cat, v]) => ({
        category: cat,
        income: Number(v.income || 0).toFixed(2),
        expense: Number(v.expense || 0).toFixed(2),
        net: Number(v.net || 0).toFixed(2),
      }));

      // Sheet 4: top expense categories
      const rowsTop = rollups.topExpenses.map(([cat, v]) => ({
        category: cat,
        expense: Number(v.expense || 0).toFixed(2),
        income: Number(v.income || 0).toFixed(2),
        net: Number(v.net || 0).toFixed(2),
      }));

      // Sheet 5: monthly averages
      const rowsAvg = [{
        months: rollups.monthlyAvg.monthCount,
        avg_income: Number(rollups.monthlyAvg.income).toFixed(2),
        avg_expense: Number(rollups.monthlyAvg.expense).toFixed(2),
        avg_net: Number(rollups.monthlyAvg.net).toFixed(2),
      }];

      // Multi-section CSV (simple separators)
      const sections = [
        ['Transactions (filtered)'],
        toCSV(rowsTx),
        [''],
        ['Monthly rollup'],
        toCSV(rowsMonth),
        [''],
        ['Category rollup'],
        toCSV(rowsCat),
        [''],
        ['Top expense categories'],
        toCSV(rowsTop),
        [''],
        ['Monthly averages'],
        toCSV(rowsAvg),
      ];
      const csv = sections.map((s) => (Array.isArray(s) ? s.join(',') : s)).join('\n');

      const fname = `base44-report-${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.csv`;
      const uri = FileSystem.cacheDirectory + fname;
      await FileSystem.writeAsStringAsync(uri, csv);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export report',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Exported', `Saved to cache:\n${uri}`);
      }
    } catch (e) {
      console.warn('[report] export failed', e);
      Alert.alert('Export failed', String(e?.message || e));
    }
  };

  // -------- UI --------
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>Filters, monthly/category rollups, top categories & averages</Text>

      {/* Filters (same UX as History) */}
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
          <Text style={[styles.amount, styles.green]}>{money(rollups.totals.income, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Expenses</Text>
          <Text style={[styles.amount, styles.red]}>{money(rollups.totals.expense, prefs)}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 6 }]}>
          <Text style={styles.label}>Net</Text>
          <Text style={[styles.amount, rollups.totals.net < 0 ? styles.red : styles.green]}>
            {money(Math.abs(rollups.totals.net), prefs)}
          </Text>
        </View>
      </View>

      {/* Monthly rollup list */}
      <View style={styles.card}>
        <Text style={styles.sectionH}>By Month</Text>
        <FlatList
          data={rollups.months}
          keyExtractor={(m) => m}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item: m }) => {
            const v = rollups.byMonth[m];
            return (
              <View style={styles.rowBetween}>
                <Text style={styles.itemLeft}>{m}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.amount, styles.green]}>{money(v.income, prefs)}</Text>
                  <Text style={[styles.amount, styles.red]}>{money(v.expense, prefs)}</Text>
                  <Text style={[styles.amount, v.net < 0 ? styles.red : styles.green]}>
                    {money(Math.abs(v.net), prefs)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.subtle}>No data for selected filters.</Text>}
        />
      </View>

      {/* Category rollup list */}
      <View style={styles.card}>
        <Text style={styles.sectionH}>By Category</Text>
        <FlatList
          data={rollups.categoriesByAbsNet}
          keyExtractor={([cat]) => cat}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item: [cat, v] }) => (
            <View style={styles.rowBetween}>
              <Text style={styles.itemLeft}>{cat}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.amount, styles.green]}>{money(v.income, prefs)}</Text>
                <Text style={[styles.amount, styles.red]}>{money(v.expense, prefs)}</Text>
                <Text style={[styles.amount, v.net < 0 ? styles.red : styles.green]}>
                  {money(Math.abs(v.net), prefs)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.subtle}>No categories found.</Text>}
        />
      </View>

      {/* Top expense categories */}
      <View style={styles.card}>
        <Text style={styles.sectionH}>Top Expense Categories</Text>
        <FlatList
          data={rollups.topExpenses}
          keyExtractor={([cat]) => cat}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          renderItem={({ item: [cat, v] }) => (
            <View style={styles.rowBetween}>
              <Text style={styles.itemLeft}>{cat}</Text>
              <Text style={[styles.amount, styles.red]}>{money(v.expense, prefs)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.subtle}>No expenses in range.</Text>}
        />
      </View>

      {/* Monthly averages */}
      <View style={styles.card}>
        <Text style={styles.sectionH}>Monthly Averages ({rollups.monthlyAvg.monthCount} month{rollups.monthlyAvg.monthCount === 1 ? '' : 's'})</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Avg Income</Text>
          <Text style={[styles.amount, styles.green]}>{money(rollups.monthlyAvg.income, prefs)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Avg Expense</Text>
          <Text style={[styles.amount, styles.red]}>{money(rollups.monthlyAvg.expense, prefs)}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 6 }]}>
          <Text style={styles.label}>Avg Net</Text>
          <Text style={[styles.amount, rollups.monthlyAvg.net < 0 ? styles.red : styles.green]}>
            {money(Math.abs(rollups.monthlyAvg.net), prefs)}
          </Text>
        </View>
      </View>
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

  sectionH: { color: '#E5E7EB', fontWeight: '800', marginBottom: 8 },
  itemLeft: { color: '#E5E7EB', fontWeight: '700' },
});
