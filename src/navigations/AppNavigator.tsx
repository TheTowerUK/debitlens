// src/navigations/AppNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import type { RootStackParamList } from './types';
import TxnEditorScreen from '../screens/TxnEditorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
// In AppNavigator.tsx
console.log('typeof LoginScreen:', typeof LoginScreen);
console.log('typeof SettingsScreen:', typeof SettingsScreen);
console.log('typeof DashboardScreen:', typeof DashboardScreen);

export default function AppNavigator() {
  
  return (
    <Stack.Navigator
      id={undefined}                      // ✅ add this line
      initialRouteName="Login"
      screenOptions={{ headerBackTitle: '' }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Budgets" component={require('../screens/BudgetsScreen').default} options={{ title: 'Budgets' }}/>
      <Stack.Screen name="TxnEditor" component={TxnEditorScreen} options={{ title: 'New transaction' }}/>
      {/* Add Account etc when ready */}
    </Stack.Navigator>
  );
}
