// src/screens/NotificationsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, Pressable, Alert } from 'react-native';
import { useApp } from '../state/AppState';
import {
  initNotifications,
  scheduleTestNotification,
  rescheduleFromPrefs,
  getScheduled,
  cancelAllNotifications,
} from '../utils/notifications';

const DAYS = [
  { label: 'Sun', val: 1 },
  { label: 'Mon', val: 2 },
  { label: 'Tue', val: 3 },
  { label: 'Wed', val: 4 },
  { label: 'Thu', val: 5 },
  { label: 'Fri', val: 6 },
  { label: 'Sat', val: 7 },
];

export default function NotificationsScreen() {
  const { state, actions } = useApp();
  const base = state?.prefs?.notifications || {};
  const [dailyEnabled, setDailyEnabled] = useState(!!base.dailyEnabled);
  const [dailyTime, setDailyTime] = useState(base.dailyTime || '09:00');
  const [weeklyEnabled, setWeeklyEnabled] = useState(!!base.weeklyEnabled);
  const [weeklyDay, setWeeklyDay] = useState(base.weeklyDay || 2); // Mon
  const [weeklyTime, setWeeklyTime] = useState(base.weeklyTime || '09:00');
  const [scheduled, setScheduled] = useState([]);

  useEffect(() => {
    initNotifications();
    refreshScheduled();
  }, []);

  const savePrefs = async () => {
    const prefsPatch = {
      notifications: { dailyEnabled, dailyTime, weeklyEnabled, weeklyDay, weeklyTime },
    };
    await actions.updatePrefs(prefsPatch);
    await rescheduleFromPrefs(prefsPatch.notifications);
    await refreshScheduled();
    Alert.alert('Saved', 'Notification preferences updated.');
  };

  const refreshScheduled = async () => {
    const items = await getScheduled();
    setScheduled(items);
  };

  const clearAll = async () => {
    await cancelAllNotifications();
    await refreshScheduled();
    Alert.alert('Cleared', 'All scheduled notifications have been canceled.');
  };

  const nextLabel = useMemo(() => {
    const d = DAYS.find(d => d.val === Number(weeklyDay))?.label || 'Mon';
    return `${d} ${weeklyTime}`;
  }, [weeklyDay, weeklyTime]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.subtle}>Daily and weekly reminders</Text>

      {/* Daily */}
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Daily summary</Text>
        <Switch value={dailyEnabled} onValueChange={setDailyEnabled} />
      </View>
      <TextInput
        value={dailyTime}
        onChangeText={setDailyTime}
        placeholder="HH:MM (24h)"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Weekly */}
      <View style={[styles.rowBetween, { marginTop: 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Weekly review</Text>
          <Text style={styles.hint}>Next: {nextLabel}</Text>
        </View>
        <Switch value={weeklyEnabled} onValueChange={setWeeklyEnabled} />
      </View>

      <View style={styles.row}>
        <View style={styles.daysRow}>
          {DAYS.map((d) => (
            <Pressable
              key={d.val}
              style={[styles.dayPill, Number(weeklyDay) === d.val && styles.dayPillActive]}
              onPress={() => setWeeklyDay(d.val)}
            >
              <Text style={[styles.dayText, Number(weeklyDay) === d.val && styles.dayTextActive]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={weeklyTime}
          onChangeText={setWeeklyTime}
          placeholder="HH:MM"
          placeholderTextColor="#6B7280"
          style={[styles.input, { flex: 0.6, marginTop: 0 }]}
        />
      </View>

      <Pressable style={styles.btnSave} onPress={savePrefs}>
        <Text style={styles.btnText}>Save</Text>
      </Pressable>

      <View style={styles.row}>
        <Pressable style={styles.btnSecondary} onPress={() => scheduleTestNotification({ title: 'Base44', body: 'This is a test' })}>
          <Text style={styles.btnText}>Send Test</Text>
        </Pressable>
        <Pressable style={styles.btnCancel} onPress={clearAll}>
          <Text style={styles.btnText}>Cancel All</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Scheduled ({scheduled.length})</Text>
      {scheduled.length === 0 ? (
        <Text style={styles.hint}>No notifications scheduled</Text>
      ) : (
        scheduled.map((s, idx) => (
          <Text style={styles.item} key={idx}>
            {JSON.stringify(s.trigger)}
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 24 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtle: { color: '#9CA3AF', marginBottom: 16, marginTop: 4 },
  label: { color: '#E5E7EB', fontSize: 16, fontWeight: '600' },
  hint: { color: '#9CA3AF', fontSize: 12 },

  row: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },

  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  dayPill: { backgroundColor: '#1F2937', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  dayPillActive: { backgroundColor: '#2563EB' },
  dayText: { color: '#fff', fontWeight: '700' },
  dayTextActive: { color: '#fff' },

  sectionTitle: { color: '#E5E7EB', fontSize: 14, fontWeight: '700' },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  btnSecondary: { backgroundColor: '#6B7280', borderRadius: 8, paddingVertical: 12, alignItems: 'center', flex: 1 },
  btnCancel: { backgroundColor: '#374151', borderRadius: 8, paddingVertical: 12, alignItems: 'center', flex: 1 },
  btnText: { color: '#fff', fontWeight: '700' },

  item: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
});
