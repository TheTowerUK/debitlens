// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useState, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';
import AppProvider from './src/state/AppProvider';

export default function App() {
  const [Navigator, setNavigator] = useState<React.ComponentType<any> | null>(null);
  const [count, setCount] = useState(0);

  // heartbeat (optional)
  useEffect(() => {
    const timer = setTimeout(() => setCount((c) => c + 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  // dynamic import inside effect prevents module top-level evaluation from affecting hooks
  useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const mod = await import('./src/navigations/AppNavigator');
      // Resolve component from possible shapes: default, named AppNavigator, or module itself
      const Comp =
        (mod as any).default ?? (mod as any).AppNavigator ?? (mod as any);

      if (mounted && Comp) {
        // setNavigator expects a React component type
        setNavigator(() => Comp as React.ComponentType<any>);
      }
    } catch (err) {
      console.warn('Navigator load failed', err);
    }
  })();
  return () => {
    mounted = false;
  };
}, []);

  const Placeholder = useMemo(
    () => () => (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>App Navigator placeholder</Text>
      </View>
    ),
    []
  );

  const ActiveNavigator = Navigator ?? Placeholder;

  return (
    <AppProvider>
      <NavigationContainer>
        <ActiveNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}
