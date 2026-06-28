// App.tsx
import './src/global.css';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';

import { AppProvider } from './src/state/AppContext';
import RootNavigator from './src/navigations/RootNavigator';
import type { RootStackParamList } from './src/navigations/types';
import WebHeader from './src/components/WebHeader';
import {
  hasPin,
  loadSecuritySettings,
  markLastActiveNow,
  markUnlockedNow,
  shouldRequireUnlock,
} from './src/utils/settingsStorage';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

async function tryBiometricUnlock(): Promise<boolean> {
  const security = await loadSecuritySettings();
  if (!security.biometricsEnabled) return false;

  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHardware || !isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock DebitLens',
      fallbackLabel: 'Use PIN',
    });
    if (result.success) {
      await markUnlockedNow();
      return true;
    }
  } catch {
    // fall through to PIN
  }
  return false;
}

function SessionWatcher({
  navigationRef,
}: {
  navigationRef: React.RefObject<ReturnType<typeof createNavigationContainerRef<RootStackParamList>> | null>;
}) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'active' && (nextState === 'background' || nextState === 'inactive')) {
        const pinExists = await hasPin();
        if (pinExists) {
          await markLastActiveNow();
        }
        return;
      }

      if ((prevState === 'background' || prevState === 'inactive') && nextState === 'active') {
        const pinExists = await hasPin();
        if (!pinExists) return;

        const needsUnlock = await shouldRequireUnlock();
        if (!needsUnlock) return;

        const unlocked = await tryBiometricUnlock();
        if (unlocked) return;

        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login', params: { flow: 'sign' } }],
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
