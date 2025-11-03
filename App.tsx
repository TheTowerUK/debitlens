// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';

import AppProvider from './src/state/AppProvider';
import AppNavigator from './src/navigations/AppNavigator';

// Debug logs – these are what we care about right now
console.log('React version:', (React as any)?.version);
console.log('AppNavigator typeof:', typeof AppNavigator); // should be "function"

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}
