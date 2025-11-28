// src/notifications/NotificationBootstrapper.tsx
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useApp } from '../state/AppContext';

// Show local notifications as alerts by default
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,

    // Newer expo-notifications fields:
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


async function scheduleDailyLocal(timeHHMM: string | undefined) {
  try {
    const [hh, mm] = String(timeHHMM || '09:00')
      .split(':')
      .map((x) => parseInt(x, 10) || 0);

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
        channelId:
          Platform.OS === 'android' ? 'DebitLens-default' : undefined,
      },
    });
  } catch (e) {
    console.warn('[notifications] schedule error', e);
  }
}

const NotificationBootstrapper: React.FC = () => {
  const { state } = useApp();

  const enabled = !!state?.prefs?.notifications?.enabled;
  const dailyTime = state?.prefs?.notifications?.dailyTime || '09:00';

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Create Android channel (no-op on iOS)
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync(
              'DebitLens-default',
              {
                name: 'DebitLens',
                importance: Notifications.AndroidImportance.DEFAULT,
              }
            );
          } catch (e) {
            console.warn('[notifications] set channel failed', e);
          }
        }

        if (!enabled || !mounted) return;

        // Ask for permission (idempotent)
        const { status } =
          await Notifications.requestPermissionsAsync();
        if (status !== 'granted' || !mounted) return;

        await scheduleDailyLocal(dailyTime);
      } catch (e) {
        console.warn('[notifications] bootstrap error', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [enabled, dailyTime]);

  return null;
};

export default NotificationBootstrapper;
