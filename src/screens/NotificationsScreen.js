// src/screens/NotificationsScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, Switch, TextInput, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useApp } from '../state/AppState';
import { money } from '../utils/money';

// Helpers to compute effective budgets like BudgetsScreen (incl. rollover)
const pad = (n) => String(n).padStart(2, '0');
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const thisMonthStr = ym(new Date());
const prevMonthStr = ym(new Date(new Date().setMonth(new Date().getMonth() - 1)));

function computeBudgetRows(state) {
  const prefs = state?.prefs || {};
  const rollover = !!prefs.budgetRollover;
  const budgets = state?.budgets || [];
  const txns = state?.transactions || [];

  const expBy = { [thisMonthStr]: {}, [prevMonthStr]: {} };
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    const m = (t.date || '').slice(0, 7);
    if (m !== thisMonthStr && m !== prevMonthStr) continue;
    const cat = (t.category || 'Uncategorized').trim();
    expBy[m][cat] = (expBy[m][cat] || 0) + Number(t.amount || 0);
  }

  const limBy = { [thisMonthStr]: {}, [prevMonthStr]: {} };
  for (const b of budgets) {
    const m = b.month || thisMonthStr;
    if (m !== thisMonthStr && m !== prevMonthStr) continue;
    const cat = (b.category || 'Uncategorized').trim();
    limBy[m][cat] = (limBy[m][cat] || 0) + Number(b.limit || 0);
  }

  const rows = budgets
    .filter((b) => !b.month || b.month === thisMonthStr)
    .map((b) => {
      const cat = (b.category || 'Uncategorized').trim();
      const spent = expBy[thisMonthStr][cat] || 0;
      const base = Number(b.limit || 0);
      const carry = Math.max(0, (limBy[prevMonthStr][cat] || 0) - (expBy[prevMonthStr][cat] || 0));
      const effective = rollover ? base + carry : base;
      const pct = effective > 0 ? spent / effective : 0;
      const remaining = Math.max(0, effective - spent);
      return { id: b.id, category: cat, base, carry, effective, spent, pct, remaining };
    })
    .sort((a, b) => b.pct - a.pct); // highest usage first

  return rows;
}

export default function NotificationsScreen() {
  const { state, actions } = useApp();
  const prefs = state?.prefs || {};
  const notif = prefs.notifications || {};

  const [enabled, setEnabled] = useState(!!notif.enabled);
  const [threshold, setThreshold] = useState(String((notif.threshold ?? 0.8) * 100)); // display as %
  const [dailyTime, setDailyTime] = useState(notif.dailyTime || '09:00');

  const rows = useMemo(() => computeBudgetRows(state), [state?.transactions, state?.budgets, state?.prefs?.budgetRollover]);

  const risky = useMemo(() => {
    const th = Math.min(100, Math.max(1, parseFloat(threshold) || 80)) / 100;
    return rows.filter((r) => r.effective > 0 && r.pct >= th);
  }, [rows, threshold]);

  const savePrefs = async () => {
    const th = Math.min(100, Math.max(1, parseFloat(threshold) || 80)) / 100;
    await actions.updatePrefs({
      notifications: { enabled, threshold: th, dailyTime },
    });
    Alert.alert('Saved', 'Notification preferences updated.');
  };

  const testAlert = async () => {
    const thPct = Math.round((Math.min(100, Math.max(1, parseFloat(threshold) || 80))) );
    const body = risky.length
      ? `⚠️ ${risky.length} budget${risky.length === 1 ? '' : 's'} over ${thPct}%`
      : `All budgets below ${thPct}%`;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Budget alert (test)', body },
      trigger: null, // fire immediately
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.subtle}>Budget alerts and daily summary</Text>

      {/* Settings card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable alerts</Text>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        <View style={{ height: 8 }} />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Alert threshold</Text>
          <View style={styles.inline}>
            <TextInput
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="number-pad"
              style={styles.inputSmall}
              placeholder="80"
              placeholderTextColor="#6B7280"
            />
            <Text style={styles.label}>%</Text>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Daily summary at</Text>
          <TextInput
            value={dailyTime}
            onChangeText={setDailyTime}
            keyboardType="numbers-and-punctuation"
            style={styles.inputSmallWide}
            placeholder="09:00"
            placeholderTextColor="#6B7280"
          />
        </View>

        <View style={styles.row}>
          <Pressable style={[styles.btnSave, { marginRight: 8 }]} onPress={savePrefs}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={testAlert}>
            <Text style={styles.btnText}>Test Alert</Text>
          </Pressable>
        </View>
      </View>

      {/* At-risk budgets */}
      <View style={styles.card}>
        <Text style={styles.sectionH}>At Risk</Text>
        {risky.length === 0 ? (
          <Text style={styles.subtle}>No budgets above the current threshold.</Text>
        ) : (
          risky.map((r) => (
            <View key={r.id} style={styles.rowBetween}>
              <Text style={styles.itemLeft}>{r.category}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemRight}>
                  {Math.round(r.pct * 100)}% • {money(r.spent, state?.prefs)} / {money(r.effective, state?.prefs)}
                </Text>
                <Text style={[styles.itemRight, r.remaining <= 0 ? styles.red : styles.green]}>
                  Remaining {money(r.remaining, state?.prefs)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 16, paddingTop: Platform.OS === 'ios' ? 44 : 16 },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF', marginBottom: 12 },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },

  label: { color: '#E5E7EB', fontWeight: '700' },

  inline: { flexDirection: 'row', alignItems: 'center' },
  inputSmall: {
    backgroundColor: '#0F172A', color: '#fff', borderColor: '#1F2937',
    borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, width: 64, marginRight: 6,
  },
  inputSmallWide: {
    backgroundColor: '#0F172A', color: '#fff', borderColor: '#1F2937',
    borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, width: 86,
  },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#6B7280', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },

  sectionH: { color: '#E5E7EB', fontWeight: '800', marginBottom: 8 },

  itemLeft: { color: '#E5E7EB', fontWeight: '700' },
  itemRight: { color: '#E5E7EB', fontWeight: '700' },

  red: { color: '#DC2626' },
  green: { color: '#34D399' },
});
