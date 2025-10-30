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
        // change path if your navigator file uses a different folder/name
        const mod = await import('./src/navigations/AppNavigator');
        // module default or named export
        const Comp = (mod && (mod.default || mod.AppNavigator || mod)) as any;
        if (mounted && Comp) setNavigator(() => Comp);
      } catch (err) {
        // keep Navigator null to render placeholder; log for debugging
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
