// src/navigations/RootNavigator.tsx
import React from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import AccountScreen from '../screens/AccountScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import TransferScreen from '../screens/TransferScreen';
import RecentActivityScreen from '../screens/RecentActivityScreen';
import HistoryScreen from '../screens/HistoryScreen';
import TxnEditorScreen from '../screens/TxnEditorScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import RecurringScreen from '../screens/RecurringScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import RecurringEditorScreen from '../screens/RecurringEditorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import DataExportImportScreen from '../screens/DataExportImportScreen';
import ImportCsvScreen from '../screens/ImportCsvScreen';
import SplashAuthScreen from '../screens/SplashAuthScreen';
import BudgetEditorScreen from '../screens/BudgetEditorScreen';
import ReportDetailScreen from '../screens/ReportDetailScreen';
import HelpScreen from '../screens/HelpScreen';
import AboutScreen from '../screens/AboutScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import { brandHeaderOptions } from './headerOptions';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      // ✅ TS fix: some @react-navigation type versions require `id`
      id={undefined as any}
      initialRouteName="Login"
      screenOptions={{
        ...brandHeaderOptions,
        headerShown: Platform.OS !== 'web',
      }}
    >
      {/* Login screen - no header */}
      <Stack.Screen 
        name="Login" 
        component={SplashAuthScreen}
        options={{ headerShown: false }}
      />
      
      {/* Dashboard - Settings on left, centered title */}
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: 'Dashboard',
          headerTitleAlign: 'center',

          headerLeft: () => (
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              hitSlop={10}
              style={{ paddingHorizontal: 12, paddingVertical: 8 }}
            >
              <Text style={{ color: '#93C5FD', fontWeight: '700' }}>Settings</Text>
            </Pressable>
          ),

          headerLeftContainerStyle: { width: 90 },
          headerRightContainerStyle: { width: 90 },

          headerRight: () => null,
        })}
      />

      {/* All other screens get consistent headers with Back button on right */}
      <Stack.Screen 
        name="Account" 
        component={AccountScreen}
        options={{ title: 'Account' }}
      />
      <Stack.Screen 
        name="AddAccount" 
        component={AddAccountScreen}
        options={{ title: 'Add Account' }}
      />
      <Stack.Screen 
        name="Transfer" 
        component={TransferScreen}
        options={{ title: 'Transfer' }}
      />
      <Stack.Screen 
        name="RecentActivity" 
        component={RecentActivityScreen}
        options={{ title: 'Recent Activity' }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />

      {/* TxnEditor can override headerRight for Delete button */}
      <Stack.Screen 
        name="TxnEditor" 
        component={TxnEditorScreen}
        options={{ title: 'Transaction' }}
      />

      <Stack.Screen 
        name="Payments" 
        component={PaymentsScreen}
        options={{ title: 'Payments' }}
      />
      <Stack.Screen 
        name="Recurring" 
        component={RecurringScreen}
        options={{ title: 'Recurring' }}
      />

      <Stack.Screen 
        name="Budgets" 
        component={BudgetsScreen}
        options={{ title: 'Budgets' }}
      />
      <Stack.Screen 
        name="BudgetEditor" 
        component={BudgetEditorScreen}
        options={{ title: 'Budget' }}
      />

      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen 
        name="RecurringEditor" 
        component={RecurringEditorScreen}
        options={{ title: 'Recurring Item' }}
      />

      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen 
        name="Reports" 
        component={ReportsScreen}
        options={{ title: 'Reports' }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: 'Help & Guide' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: 'About' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: 'Privacy Policy' }}
      />

      <Stack.Screen
        name="DataExportImport"
        component={DataExportImportScreen}
        options={{ title: 'Data' }}
      />
      <Stack.Screen 
        name="ImportCSV" 
        component={ImportCsvScreen}
        options={{ title: 'Import CSV' }}
      /> 
      <Stack.Screen 
        name="ReportDetail" 
        component={ReportDetailScreen}
        options={{ title: 'Report Details' }}
      />
    </Stack.Navigator>
  );
}
