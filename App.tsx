// App.tsx
//import 'react-native-gesture-handler';
//import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppProvider';

// 👇 real screens we want to test
import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DashboardScreen from './src/screens/DashboardScreen';

// 🔍 debug: these MUST be "function"
//console.log('React version:', (React as any)?.version);
console.log('typeof LoginScreen:', typeof LoginScreen);
console.log('typeof SettingsScreen:', typeof SettingsScreen);
console.log('typeof DashboardScreen:', typeof DashboardScreen);

const Stack = createNativeStackNavigator();

function DummyScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Dummy screen OK</Text>
    </View>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Dummy">
          {/* Start with only Dummy so we know root is still OK */}
          <Stack.Screen name="Dummy" component={DummyScreen} />

          {/* We'll enable these one by one after we see the console logs */}
          {/*
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          */}
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
