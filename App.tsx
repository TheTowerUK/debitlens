// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppProvider';
import type { RootStackParamList } from './src/navigations/types';

import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ImportCsvScreen from './src/screens/ImportCsvScreen';
import AccountScreen from './src/screens/AccountScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

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
            component={DashboardScreen}
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
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={{ title: 'Account' }}
          />
          <Stack.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'History' }}
          />
          <Stack.Screen
            name="Reports"
            component={ReportsScreen}
            options={{ title: 'Reports' }}
          />
          <Stack.Screen
            name="Budgets"
            component={BudgetsScreen}
            options={{ title: 'Budgets' }}
          />

        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
