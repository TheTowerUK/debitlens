// src/notifications/NotificationBootstrapper.tsx
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show local notifications as alerts by default
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,

    // Newer expo-notifications fields (ignored on older SDKs)
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function scheduleDailyLocal(timeHHMM?: string) {
  try {
    const [hh, mm] = String(timeHHMM || '09:00')
      .split(':')
      .map((x) => parseInt(x, 10) || 0);

    // Cancel previous schedules we manage
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if ((n as any)?.identifier?.startsWith?.('DebitLens_daily_')) {
        await Notifications.cancelScheduledNotificationAsync(
          (n as any).identifier
        );
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

        if (!mounted) return;

        // Ask for permission (idempotent)
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted' || !mounted) return;

        // For now we just always schedule at a fixed time (09:00).
        // Later we can read this from user prefs when that feature exists.
        await scheduleDailyLocal('09:00');
      } catch (e) {
        console.warn('[notifications] bootstrap error', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return null;
};

export default NotificationBootstrapper;
