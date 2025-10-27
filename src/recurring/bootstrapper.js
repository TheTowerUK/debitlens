// src/notifications/bootstrapper.js
import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useApp } from '../state/AppState';

// Show local notifications as alerts by default
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function scheduleDailyLocal(timeHHMM) {
  try {
    const [hh, mm] = String(timeHHMM || '09:00').split(':').map(x => parseInt(x, 10) || 0);

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
  } catch (e) {
    console.warn('[notifications] schedule error', e);
  }
}

export default function NotificationBootstrapper() {
  const { state } = useApp?.() || { state: {} }; // extra guard if useApp changes

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Create Android channel (no-op on iOS)
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('DebitLens-default', {
              name: 'DebitLens',
              importance: Notifications.AndroidImportance.DEFAULT,
            });
          } catch (e) {
            console.warn('[notifications] set channel failed', e);
          }
        }

        const enabled = !!state?.prefs?.notifications?.enabled;
        if (!enabled || !mounted) return;

        // Ask for permission (idempotent)
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted' || !mounted) return;

        const t = state?.prefs?.notifications?.dailyTime || '09:00';
        await scheduleDailyLocal(t);
      } catch (e) {
        console.warn('[notifications] bootstrap error', e);
      }
    })();

    return () => { mounted = false; };
  }, [state?.prefs?.notifications?.enabled, state?.prefs?.notifications?.dailyTime]);

  return null;
}
