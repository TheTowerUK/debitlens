// src/utils/notifications.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show alerts by default (no sound/badge unless you want)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Android channel id
const ANDROID_CHANNEL_ID = 'default';

/** One-time init: sets Android channel */
export async function initNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: undefined,
        vibrationPattern: [0, 200, 100, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  } catch (e) {
    console.warn('[notifications] init failed', e);
  }
}

/** Ask permissions if needed; returns boolean granted */
export async function ensurePermissions() {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowBadge: false, allowSound: true, allowAlert: true },
    });
    return !!req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch (e) {
    console.warn('[notifications] permission check failed', e);
    return false;
  }
}

function parseTimeHHMM(hhmm, fallback = { hour: 9, minute: 0 }) {
  if (!hhmm || typeof hhmm !== 'string') return fallback;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  let hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  let minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}

/** Schedules a local notification soon (for testing) */
export async function scheduleTestNotification({ title = 'Test', body = 'Hello from Base44', seconds = 3 } = {}) {
  const ok = await ensurePermissions();
  if (!ok) throw new Error('Notification permissions not granted');
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { seconds, channelId: ANDROID_CHANNEL_ID },
  });
}

/** Daily summary at local time (HH:MM), repeats every day */
export async function scheduleDailySummary(timeHHMM = '09:00') {
  const ok = await ensurePermissions();
  if (!ok) throw new Error('Notification permissions not granted');

  const { hour, minute } = parseTimeHHMM(timeHHMM, { hour: 9, minute: 0 });
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Daily cashflow',
      body: 'Open Base44 for today’s balance & transactions.',
    },
    trigger: { hour, minute, repeats: true, channelId: ANDROID_CHANNEL_ID },
  });
}

/**
 * Weekly summary. weekday: 1–7 (Sun=1, Mon=2, … Sat=7)
 * timeHHMM: 'HH:MM'
 */
export async function scheduleWeeklySummary(weekday = 2, timeHHMM = '09:00') {
  const ok = await ensurePermissions();
  if (!ok) throw new Error('Notification permissions not granted');

  const { hour, minute } = parseTimeHHMM(timeHHMM, { hour: 9, minute: 0 });
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly review',
      body: 'Check your weekly spend, income and category breakdown.',
    },
    trigger: { weekday, hour, minute, repeats: true, channelId: ANDROID_CHANNEL_ID },
  });
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[notifications] cancelAll failed', e);
  }
}

export async function getScheduled() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('[notifications] getScheduled failed', e);
    return [];
  }
}

/** Convenience: apply prefs.notifications -> scheduled jobs */
export async function rescheduleFromPrefs(prefs) {
  // prefs shape: { dailyEnabled, dailyTime, weeklyEnabled, weeklyDay, weeklyTime }
  await cancelAllNotifications();
  if (!prefs) return;

  const jobs = [];
  if (prefs.dailyEnabled) {
    jobs.push(scheduleDailySummary(prefs.dailyTime || '09:00'));
  }
  if (prefs.weeklyEnabled) {
    const weekday = Number(prefs.weeklyDay || 2); // default Monday (2)
    jobs.push(scheduleWeeklySummary(weekday, prefs.weeklyTime || '09:00'));
  }
  await Promise.allSettled(jobs);
}
