// src/screens/NotificationsScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import Constants from 'expo-constants';
import { useApp } from '../state/AppProvider';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isValidTime = (s) => /^\d{2}:\d{2}$/.test(s) && +s.slice(0, 2) < 24 && +s.slice(3, 5) < 60;

export default function NotificationsScreen() {
  const { state, actions } = useApp();
  const base = state?.prefs?.notifications || { enabled: true, threshold: 0.8, dailyTime: '09:00' };

  // Local form state
  const [enabled, setEnabled] = useState(!!base.enabled);
  const [thresholdStr, setThresholdStr] = useState(String(base.threshold ?? 0.8));
  const [dailyTime, setDailyTime] = useState(base.dailyTime || '09:00');
  const [saving, setSaving] = useState(false);

  const threshold = useMemo(() => {
    const n = Number(thresholdStr);
    return Number.isFinite(n) ? clamp(n, 0, 1) : 0.8;
  }, [thresholdStr]);

  const inExpoGo = Constants.appOwnership === 'expo';

  const onSave = async () => {
    if (!isValidTime(dailyTime)) {
      return Alert.alert('Time format', 'Please enter time as HH:MM (24h).');
    }
    setSaving(true);
    try {
      await actions.updatePrefs({
        notifications: {
          enabled,
          threshold,
          dailyTime,
        },
      });
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch (e) {
      console.warn('[notifications] save failed', e);
      Alert.alert('Save failed', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    // Avoid noisy warning path in Android + Expo Go
    if (inExpoGo && Platform.OS === 'android') {
      Alert.alert('Not available in Expo Go (Android)', 'Use a development build to test push/notifications on Android.');
      return;
    }
    try {
      const Notifications = await import('expo-notifications');

      // Ask permission (iOS) / channel (Android) as needed
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      } else {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission not granted', 'Enable notifications in system settings to receive alerts.');
          return;
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test notification',
          body: 'If you see this, local notifications are working!',
          data: { screen: 'Budgets' },
        },
        trigger: null, // fire immediately
      });
      Alert.alert('Sent', 'A test notification should appear shortly.');
    } catch (e) {
      console.warn('[notifications] test failed', e);
      Alert.alert('Test failed', 'Could not schedule a test notification.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.subtle}>
        Budget threshold alerts and a daily reminder.
      </Text>

      {/* Enable/disable */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable notifications</Text>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: '#374151', true: '#2563EB' }}
            thumbColor="#fff"
          />
        </View>
        <Text style={[styles.subtle, { marginTop: 6 }]}>
          When enabled, you’ll get an alert the moment a category’s spend crosses the chosen threshold.
        </Text>
      </View>

      {/* Threshold */}
      <View style={styles.card}>
        <Text style={styles.label}>Budget threshold</Text>
        <Text style={styles.subtle}>Enter a value between 0 and 1. Example: 0.8 = 80% of the budget.</Text>
        <TextInput
          value={thresholdStr}
          onChangeText={setThresholdStr}
          placeholder="0.8"
          placeholderTextColor="#6B7280"
          keyboardType="decimal-pad"
          style={[styles.input, { marginTop: 8 }]}
        />
        <Text style={styles.example}>
          Current: {(threshold * 100).toFixed(0)}%
        </Text>
      </View>

      {/* Daily reminder time */}
      <View style={styles.card}>
        <Text style={styles.label}>Daily summary time</Text>
        <Text style={styles.subtle}>24-hour format (HH:MM). Example: 09:00</Text>
        <TextInput
          value={dailyTime}
          onChangeText={setDailyTime}
          placeholder="09:00"
          placeholderTextColor="#6B7280"
          style={[styles.input, { marginTop: 8 }]}
        />
        <Text style={styles.example}>
          You can add a daily summary in the future; saved time will be used by the scheduler.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnSave, { marginRight: 8, opacity: saving ? 0.7 : 1 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={sendTest}>
          <Text style={styles.btnText}>Send test</Text>
        </Pressable>
      </View>

      {/* Expo Go note */}
      {inExpoGo && Platform.OS === 'android' && (
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.subtle}>
            On Android, Expo Go has limited notification support. Use a development build to fully test push/local notifications.
          </Text>
        </View>
      )}
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
  subtle: { color: '#9CA3AF' },
  example: { color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  label: { color: '#E5E7EB', fontWeight: '800', marginBottom: 4 },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSave: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: '#1F2937' },
  btnText: { color: '#fff', fontWeight: '700' },
});
