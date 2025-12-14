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
import ImportCsvScreen from '../screens/ImportCsvScreen';
import SplashAuthScreen from '../screens/SplashAuthScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Account: { accountId?: string } | undefined;
  AddAccount: undefined;
  Transfer: { fromAccountId?: string } | undefined;
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
  ImportCSV: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  // TS workaround for `id`
  const navigatorProps = {
    id: undefined as undefined,
    initialRouteName: 'Login' as const,
  };

  return (
    <Stack.Navigator
      {...(navigatorProps as any)}
    screenOptions={({ route }) => ({
      // Hide header on Dashboard and Login
      headerShown: route.name !== 'Dashboard' && route.name !== 'Login',

      headerStyle: { backgroundColor: '#020617' },
      headerTintColor: '#F9FAFB',
      headerTitleStyle: { fontWeight: '700' },
      headerBackTitleVisible: false,
    })}

    >
      {/* Auth / splash */}
      <Stack.Screen
        name="Login"
        component={SplashAuthScreen}
        options={{ headerShown: false }} // this also works, and overrides screenOptions
      />

      {/* Main */}
      <Stack.Screen name="Dashboard" component={DashboardScreen} />

      {/* Accounts */}
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen
        name="RecentActivity"
        component={RecentActivityScreen}
      />

      {/* Editor */}
      <Stack.Screen name="TxnEditor" component={TxnEditorScreen} />

      {/* Dashboard-linked */}
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="Recurring" component={RecurringScreen} />
      <Stack.Screen name="Budgets" component={BudgetsScreen} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
      />
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
        options={{ title: 'Export / Import' }}
      />
      <Stack.Screen name="ImportCSV" component={ImportCsvScreen} />
    </Stack.Navigator>
  );
};

export default RootNavigator;
