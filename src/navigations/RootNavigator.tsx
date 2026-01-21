// src/navigations/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import AccountScreen from '../screens/AccountScreen';
import AddAccountScreen from '../screens/AddAccountScreen';
import TransferScreen from '../screens/TransferScreen';
import RecentActivityScreen from '../screens/RecentActivityScreen';
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
import { brandHeaderOptions } from './headerOptions';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;

  Account: { accountId?: string } | undefined;
  AddAccount: undefined;
  Transfer: { fromAccountId?: string } | undefined;
  RecentActivity: undefined;

  ReportDetail: {
    categoryKey: string;
    period: 'thisMonth' | 'lastMonth' | 'allTime' | 'month';
    monthKey?: string; // 'YYYY-MM' when period === 'month'
  };

  TxnEditor:
    | {
        id?: string;
        accountId?: string;
        type?: 'income' | 'expense';
      }
    | undefined;

  Payments: undefined;
  Recurring: undefined;

  Budgets: undefined;
  BudgetEditor: { id?: string; mode?: 'create' } | undefined;

  Notifications: undefined;
  RecurringEditor: { id?: string } | undefined;

  Settings: undefined;
  Reports: undefined;

  DataExportImport: undefined;
  ImportCSV: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      // ✅ TS fix: some @react-navigation type versions require `id`
      id={undefined as any}
      initialRouteName="Login"
      screenOptions={{
        ...brandHeaderOptions,
        headerShown: true,
      }}
    >
      {/* Login screen - no header */}
      <Stack.Screen 
        name="Login" 
        component={SplashAuthScreen}
        options={{ headerShown: false }}
      />
      
      {/* Dashboard - no back button needed (root screen after login) */}
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          ...brandHeaderOptions,
          title: 'Dashboard',
          headerRight: undefined, // No back button on Dashboard
        }}
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
