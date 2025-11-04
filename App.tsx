// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ImportCsvScreen from './src/screens/ImportCsvScreen';

import AppProvider from './src/state/AppProvider';
import type { RootStackParamList } from './src/navigations/types';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function DummyDashboardScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Dashboard placeholder</Text>
    </View>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Login' }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DummyDashboardScreen}
            options={{ title: 'Dashboard' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen
            name="ImportCSV"
            component={ImportCsvScreen}
            options={{ title: 'Import CSV' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
