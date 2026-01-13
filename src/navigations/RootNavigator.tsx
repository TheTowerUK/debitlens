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
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={SplashAuthScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />

      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="RecentActivity" component={RecentActivityScreen} />

      <Stack.Screen name="TxnEditor" component={TxnEditorScreen} />

      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} />

      <Stack.Screen name="Budgets" component={BudgetsScreen} />
      <Stack.Screen name="BudgetEditor" component={BudgetEditorScreen} />

      <Stack.Screen name="Notifications" component={NotificationsScreen}   options={{
    headerShown: true,
    title: 'Notifications',
  }}/>
      <Stack.Screen name="RecurringEditor" component={RecurringEditorScreen} />

      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />

      <Stack.Screen name="DataExportImport" component={DataExportImportScreen}   options={{
    headerShown: true,
    title: 'Data',
  }}/>
      <Stack.Screen name="ImportCSV" component={ImportCsvScreen} /> 
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />


    </Stack.Navigator>
  );
}
