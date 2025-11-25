// src/navigation/RootNavigator.tsx
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

export type RootStackParamList = {
  Dashboard: undefined;

  Account: { accountId?: string } | undefined;
  AddAccount: undefined;
  Transfer: undefined;
  RecentActivity: undefined;

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
  Notifications: undefined;
  RecurringEditor: { id?: string } | undefined;

  Settings: undefined;
  Reports: undefined;
  DataExportImport: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  // Work around the odd type that requires an 'id' prop of type undefined
  const navigatorProps = {
    id: undefined,
    screenOptions: { headerShown: false },
  } as const;

  return (
    <Stack.Navigator {...(navigatorProps as any)}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />

      {/* Accounts */}
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="RecentActivity" component={RecentActivityScreen} />

      {/* Editor */}
      <Stack.Screen name="TxnEditor" component={TxnEditorScreen} />

      {/* Dashboard-linked */}
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} />
      <Stack.Screen name="Budgets" component={BudgetsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen
        name="RecurringEditor"
        component={RecurringEditorScreen}
      />

      {/* Other */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen
        name="DataExportImport"
        component={DataExportImportScreen}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
