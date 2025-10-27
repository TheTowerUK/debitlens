// src/notifications/bootstrapper.js
import React, { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useApp } from '../state/AppState';

// Local notifications show as alerts by default.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Schedules a daily local notification at HH:MM (24h) local time
async function scheduleDailyLocal(timeHHMM) {
  const [hh, mm] = String(timeHHMM || '09:00').split(':').map((x) => parseInt(x, 10) || 0);
  // Cancel previous schedules we manage
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.identifier?.startsWith?.('DebitLens_daily_')) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  await Notifications.scheduleNotificationAsync({
    identifier: `DebitLens_daily_${hh}_${mm}`,
    content: {
      title: 'Daily budget check',
      body: 'Tap to review budgets and alerts.',
      data: { screen: 'Notifications' },
    },
    trigger: {
      hour: hh,
      minute: mm,
      repeats: true,
      channelId: Platform.OS === 'android' ? 'DebitLens-default' : undefined,
    },
  });
}

export default function NotificationBootstrapper() {
  const { state } = useApp();

  useEffect(() => {
    const inExpoGo = Constants.appOwnership === 'expo';

    // Local notifications are okay in Expo Go (the warnings you saw were for remote push on Android).
    // We still skip any channel setup on web.
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('DebitLens-default', {
          name: 'DebitLens',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      if (!state?.prefs?.notifications?.enabled) return;

      // Ask for permission (idempotent)
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // (Re)schedule daily summary at the user’s preferred time
      const t = state?.prefs?.notifications?.dailyTime || '09:00';
      await scheduleDailyLocal(t);
    })();
  }, [state?.prefs?.notifications?.enabled, state?.prefs?.notifications?.dailyTime]);

  return null;
}
