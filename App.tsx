// App.tsx
import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, View } from 'react-native';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';

import { AppProvider } from './src/state/AppContext';
import RootNavigator, { RootStackParamList } from './src/navigations/RootNavigator';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

const SESSION_TIMEOUT_MS = 60_000; // 1 minute

function SessionWatcher({ children }: { children: React.ReactNode }) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      // Only reset navigation if we have a nav tree ready
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Login' as keyof RootStackParamList }],
        });
      }
    }, SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    // Start timer when component mounts
    resetTimer();

    const sub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        // Whenever app comes to foreground, restart the timer
        if (state === 'active') {
          resetTimer();
        }
      }
    );

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      sub.remove();
    };
  }, [resetTimer]);

  // Any touch anywhere in the app resets the timer.
  const handleTouch = () => {
    resetTimer();
  };

  return (
    <View
      style={{ flex: 1 }}
      // This fires for *any* touch in the subtree without blocking normal gestures
      onStartShouldSetResponder={() => {
        handleTouch();
        return false; // don't steal touches from children
      }}
    >
      {children}
    </View>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SessionWatcher>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </SessionWatcher>
    </AppProvider>
  );
}
