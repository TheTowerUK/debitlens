// src/navigations/AppNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

// Core
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';

// Features
import PaymentsScreen from '../screens/Payments';
import RecurringScreen from '../screens/RecurringScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TxnEditorScreen from '../screens/TxnEditorScreen';
// File name is NavigationsScreen.tsx; import it *as* NotificationsScreen
import NotificationsScreen from '../screens/NotificationsScreen';

// Placeholders (until real screens wired)
import { Text, View } from 'react-native';
const AccountScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff' }}>Account — coming soon</Text>
  </View>
);
const AddAccountScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff' }}>Add Account — coming soon</Text>
  </View>
);
const ReportsScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff' }}>Reports — coming soon</Text>
  </View>
);

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      id={undefined} // <-- add this back to satisfy the inferred prop requirement
      initialRouteName="Login"
      screenOptions={{
        headerBackTitle: '',
        headerShown: false,
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      {/* Auth / Home */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />

      {/* Accounts */}
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} />

      {/* Editor */}
      <Stack.Screen name="TxnEditor" component={TxnEditorScreen} />

      {/* Dashboard navigations */}
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} />
      <Stack.Screen name="Budgets" component={BudgetsScreen} />

      {/* Other */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
