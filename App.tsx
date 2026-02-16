// App.tsx
import './src/global.css';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';

import { AppProvider } from './src/state/AppContext';
import RootNavigator from './src/navigations/RootNavigator';
import type { RootStackParamList } from './src/navigations/types';
import WebHeader from './src/components/WebHeader';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const STORAGE_KEY_PIN = '@debitlens/pin:v1';
const STORAGE_KEY_BIOMETRICS = '@debitlens/biometricsEnabled:v1';
const STORAGE_KEY_SESSION_TIMEOUT_MIN = '@debitlens/sessionTimeoutMinutes:v1';
const STORAGE_KEY_LAST_UNLOCKED_AT = '@debitlens/lastUnlockedAt:v1';

const RESUME_BIOMETRICS_GRACE_MS = 30_000; // only prompt if away >= 30s

function SessionWatcher({
  navigationRef,
}: {
  navigationRef: React.RefObject<any>;
}) {
  const lastBackgroundAtRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const getTimeoutMs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION_TIMEOUT_MIN);
      const minutes = Number(raw);
      const safeMinutes = minutes === 10 || minutes === 15 || minutes === 5 ? minutes : 5;
      return safeMinutes * 60_000;
    } catch {
      return 5 * 60_000;
    }
  };

  const setLastUnlockedNow = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_UNLOCKED_AT, String(Date.now()));
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'active' && (nextState === 'background' || nextState === 'inactive')) {
        lastBackgroundAtRef.current = Date.now();
        return;
      }

      if ((prevState === 'background' || prevState === 'inactive') && nextState === 'active') {
        const last = lastBackgroundAtRef.current;
        lastBackgroundAtRef.current = null;

        if (!last) return;

        const elapsed = Date.now() - last;

        const rawPin = await AsyncStorage.getItem(STORAGE_KEY_PIN);
        const pinExists = (rawPin ?? '').trim().length > 0;
        if (!pinExists) return;

        let biometricsEnabled = false;
        try {
          biometricsEnabled = (await AsyncStorage.getItem(STORAGE_KEY_BIOMETRICS)) === 'true';
        } catch {
          biometricsEnabled = false;
        }

        if (biometricsEnabled) {
          if (elapsed < RESUME_BIOMETRICS_GRACE_MS) return;
          try {
            const [hasHardware, isEnrolled] = await Promise.all([
              LocalAuthentication.hasHardwareAsync(),
              LocalAuthentication.isEnrolledAsync(),
            ]);

            if (hasHardware && isEnrolled) {
              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock DebitLens',
                fallbackLabel: 'Use device passcode',
              });

              if (result.success) {
                await setLastUnlockedNow();
                return;
              }
            }
          } catch {
            // auth error → lock to Login below
          }

          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          return;
        }

        const timeoutMs = await getTimeoutMs();
        if (elapsed < timeoutMs) return;

        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    });

    return () => sub.remove();
  }, [navigationRef]);

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <SessionWatcher navigationRef={navigationRef} />
      <NavigationContainer ref={navigationRef}>
        <View style={{ flex: 1 }}>
          {Platform.OS === 'web' && <WebHeader />}
          <View style={{ flex: 1 }}>
            <RootNavigator />
          </View>
        </View>
      </NavigationContainer>
    </AppProvider>
  );
}
