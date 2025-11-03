// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppProvider';

// 👇 add this
import type { RootStackParamList } from './src/navigations/types';

// ⬅️ give the stack your param list
const Stack = createNativeStackNavigator<RootStackParamList>();

function DummyScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Dummy screen OK</Text>
    </View>
  );
}

// and import LoginScreen
import LoginScreen from './src/screens/LoginScreen';

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DummyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
