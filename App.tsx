// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppProvider';
import type { RootStackParamList } from './src/navigations/types';

// Core screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';

// Existing screens
import SettingsScreen from './src/screens/SettingsScreen';
import ImportCsvScreen from './src/screens/ImportCsvScreen';
import AccountScreen from './src/screens/AccountScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';
import TxnEditorScreen from './src/screens/TxnEditorScreen';

// Newly wired screens you navigate to from Dashboard
import PaymentsScreen from './src/screens/Payments';
import RecurringScreen from './src/screens/RecurringScreen';
import NotificationsScreen from './src/screens/NavigationsScreen'; // <- or './src/screens/NotificationsScreen'
import RecurringEditorScreen from './src/screens/RecurringEditorScreen';
import AddAccountScreen from './src/screens/AddAccountScreen';



const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#020617' } }}
        >
          {/* Auth / Home */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />

          {/* Dashboard-linked routes */}
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="Recurring" component={RecurringScreen} />
          <Stack.Screen name="RecurringEditor" component={RecurringEditorScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} />

          {/* Other routes you already had */}
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ImportCSV" component={ImportCsvScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="AddAccount" component={AddAccountScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="TxnEditor" component={TxnEditorScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
