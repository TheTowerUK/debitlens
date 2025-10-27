import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AppProvider from './src/state/AppProvider';



export default function App() {
  return (
    <AppProvider>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Count: {count}</Text>
      </View>
    </AppProvider>
  );
}

