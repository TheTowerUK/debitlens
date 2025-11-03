// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import AppProvider from './src/state/AppProvider';

export default function App() {
  return (
    <AppProvider>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>AppProvider + root OK</Text>
      </View>
    </AppProvider>
  );
}
