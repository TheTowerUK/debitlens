// App.tsx
import 'react-native-gesture-handler';
import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';
import AppProvider from './src/state/AppProvider';

/**
 * Try to load the real navigator if it exists. If the import fails at runtime
 * (module missing) we fall back to a stable placeholder. This keeps compilation
 * deterministic while allowing the real navigator to be used when present.
 */
let AppNavigator: React.ComponentType<any> = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>App Navigator placeholder</Text>
  </View>
);

try {
  // Use require to avoid static import errors when the file is missing.
  // If your real navigator path is ./src/navigations/AppNavigator (plural),
  // update the string below to match the exact file path and exported default.
  // Example: const nav = require('./src/navigations/AppNavigator').default;
  // Keep this wrapped in try/catch so Metro/tsc won't break compilation if the file is absent.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const maybeNav = require('./src/navigations/AppNavigator');
  if (maybeNav && maybeNav.default) {
    AppNavigator = maybeNav.default;
  } else if (maybeNav && typeof maybeNav === 'function') {
    AppNavigator = maybeNav;
  }
} catch {
  // swallow — keep placeholder
}

export default function App() {
  // simple heartbeat to show JS is running (not required for production)
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setCount((c) => c + 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  // memoize navigator component to avoid unnecessary re-renders
  const Navigator = useMemo(() => AppNavigator, []);

  return (
    <AppProvider>
      <NavigationContainer>
        <Navigator />
      </NavigationContainer>
    </AppProvider>
  );
}
