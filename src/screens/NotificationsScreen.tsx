// src/screens/NotificationsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { colors as theme } from '../theme/colors';
import {
  ensurePermissions,
  initNotifications,
  rescheduleFromPrefs,
} from '../utils/notifications';
import {
  loadNotificationSettings,
  notificationSettingsToPrefs,
  saveNotificationSettings,
  type NotificationSettings,
} from '../utils/settingsStorage';

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationSettings | null>(null);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    try {
      await initNotifications();
      const loaded = await loadNotificationSettings();
      setPrefs(loaded);
    } catch {
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  useFocusEffect(
    useCallback(() => {
      void loadPrefs();
    }, [loadPrefs])
  );

  const applyAndPersist = async (patch: Partial<NotificationSettings>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      const saved = await saveNotificationSettings(patch);

      const needsSchedule = saved.dailySummaryEnabled || saved.weeklySummaryEnabled;
      if (needsSchedule) {
        const granted = await ensurePermissions();
        if (!granted) {
          Alert.alert(
            'Permission required',
            'Enable notifications in system settings to schedule local summaries.'
          );
        }
      }

      await rescheduleFromPrefs(notificationSettingsToPrefs(saved));
    } catch (e) {
      console.warn('[Notifications] save failed', e);
      Alert.alert('Save failed', 'Could not update notification settings.');
      await loadPrefs();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <View style={[styles.wrap, styles.centered]}>
        <ActivityIndicator color={theme.link} />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.subtle}>
        Local reminders on this device only. Changes are saved automatically.
      </Text>

      {saving ? (
        <Text style={styles.savingHint}>Saving…</Text>
      ) : null}

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Daily summary</Text>
            <Text style={styles.caption}>Morning cashflow reminder (default 09:00).</Text>
          </View>
          <Switch
            value={prefs.dailySummaryEnabled}
            onValueChange={(v) => void applyAndPersist({ dailySummaryEnabled: v })}
            disabled={saving}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Weekly summary</Text>
            <Text style={styles.caption}>Weekly spend and income review (default Monday 09:00).</Text>
          </View>
          <Switch
            value={prefs.weeklySummaryEnabled}
            onValueChange={(v) => void applyAndPersist({ weeklySummaryEnabled: v })}
            disabled={saving}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Reminders</Text>
            <Text style={styles.caption}>
              Preference for bill and goal nudges (stored for future use).
            </Text>
          </View>
          <Switch
            value={prefs.remindersEnabled}
            onValueChange={(v) => void applyAndPersist({ remindersEnabled: v })}
            disabled={saving}
          />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Notification behaviour can vary on {Platform.OS === 'android' ? 'Android' : 'iOS'}.
          Restart the app to confirm scheduled notifications after changing settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
  },
  savingHint: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.cardAlt,
    marginVertical: 6,
  },
  infoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  infoText: {
    color: theme.textDim,
    fontSize: 13,
  },
});
