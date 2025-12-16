// src/utils/backupReminder.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export type BackupReminderMode = 'off' | 'weekly' | 'monthly';

const MODE_KEY = 'debitlens:backupReminderMode:v1';
const NOTIF_ID_KEY = 'debitlens:backupReminderNotifId:v1';

// Defaults: Weekly Sunday 18:00, Monthly 1st 18:00
const DEFAULT_HOUR = 18;
const DEFAULT_MINUTE = 0;
const DEFAULT_WEEKDAY = 1; // Sunday (number)
const DEFAULT_MONTH_DAY = 1;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('backup-reminders', {
    name: 'Backup reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getSavedBackupReminderMode(): Promise<BackupReminderMode> {
  const raw = await AsyncStorage.getItem(MODE_KEY);
  if (raw === 'weekly' || raw === 'monthly' || raw === 'off') return raw;
  return 'off';
}

async function setSavedBackupReminderMode(mode: BackupReminderMode) {
  await AsyncStorage.setItem(MODE_KEY, mode);
}

async function getSavedNotificationId(): Promise<string | null> {
  return (await AsyncStorage.getItem(NOTIF_ID_KEY)) || null;
}

async function setSavedNotificationId(id: string | null) {
  if (!id) {
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
}

async function ensurePermissionsOrThrow() {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }

  if (status !== 'granted') {
    throw new Error('Notifications permission not granted.');
  }
}

export async function cancelBackupReminder(): Promise<void> {
  const existingId = await getSavedNotificationId();
  if (existingId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    } catch {
      // ignore
    }
  }
  await setSavedNotificationId(null);
  await setSavedBackupReminderMode('off');
}

export async function setBackupReminderMode(mode: BackupReminderMode): Promise<void> {
  await cancelBackupReminder();
  if (mode === 'off') return;

  await ensureAndroidChannel();
  await ensurePermissionsOrThrow();

  const content: Notifications.NotificationContentInput = {
    title: 'DebitLens backup reminder',
    body: 'Remember to export a full backup (JSON) to Files.',
    sound: true,
  };

  // Newer expo-notifications typings require a "type" field on calendar triggers.
  // Use `as any` to stay compatible across SDK/type changes.
  const trigger: any =
    mode === 'weekly'
      ? {
          type: 'weekly',
          weekday: DEFAULT_WEEKDAY,
          hour: DEFAULT_HOUR,
          minute: DEFAULT_MINUTE,
          repeats: true,
        }
      : {
          type: 'monthly',
          day: DEFAULT_MONTH_DAY,
          hour: DEFAULT_HOUR,
          minute: DEFAULT_MINUTE,
          repeats: true,
        };

  const id = await Notifications.scheduleNotificationAsync({ content, trigger });

  await setSavedNotificationId(id);
  await setSavedBackupReminderMode(mode);
}
