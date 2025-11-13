// src/navigations/AppNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

// Core
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';

// Features
import PaymentsScreen from '../screens/PaymentsScreen';
import RecurringScreen from '../screens/RecurringScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TxnEditorScreen from '../screens/TxnEditorScreen';
import NotificationsScreen from '../screens/NotificationsScreen'; 

// Temporary placeholders
import { Text, View } from 'react-native';
const AccountScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff' }}>Account — coming soon</Text>
  </View>
);
const ReportsScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff' }}>Reports — coming soon</Text>
  </View>
);

// Use a fresh name to avoid any accidental collisions
const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  // Narrow TS to ignore the bogus 'id' prop requirement from prior inference
  const Navigator = RootStack.Navigator as unknown as React.ComponentType<any>;
  const Screen = RootStack.Screen;

  return (
    
    <Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        headerBackTitle: '',
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      {/* Auth / Home */}
      <Screen name="Login" component={LoginScreen} />
      <Screen name="Dashboard" component={DashboardScreen} />

      {/* Accounts */}
      <Screen name="Account" component={AccountScreen} />

      {/* Editor */}
      <Screen name="TxnEditor" component={TxnEditorScreen} />

      {/* Dashboard-linked */}
      <Screen name="Payments" component={BudgetsScreen} />
      <Screen name="Recurring" component={RecurringScreen} />
      <Screen name="Budgets" component={BudgetsScreen} />
      <Screen name="Notifications" component={NotificationsScreen} />

      {/* Other */}
      <Screen name="Settings" component={SettingsScreen} />
      <Screen name="Reports" component={ReportsScreen} />
    </Navigator>
  );
}
