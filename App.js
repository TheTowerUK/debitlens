// App.js
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppState';
import { runMigrations } from 'db/migrate';
import { getDb } from './src/db/db';

const Stack = createNativeStackNavigator();

// ✅ Static screen registry (component only)
const screenRegistry = {
  SplashAuth: require('./src/screens/SplashAuthScreen').default,
  Login: require('./src/screens/LoginScreen').default,
  Dashboard: require('./src/screens/DashboardScreen').default,
  Reports: require('./src/screens/ReportListScreen').default,
  ReportDetail: require('./src/screens/ReportDetailScreen').default,
  ReportEditor: require('./src/screens/ReportEditorScreen').default,
  Settings: require('./src/screens/SettingsScreen').default,
  Account: require('./src/screens/AccountScreen').default,
  History: require('./src/screens/HistoryScreen').default,
  TxnEditor: require('./src/screens/TxnEditorScreen').default,
  Recurring: require('./src/screens/RecurringScreen').default,
  Budgets: require('./src/screens/BudgetsScreen').default,
  ImportCsvScreen: require('./src/screens/ImportCsvScreen').default,
  Notifications: require('./src/screens/NotificationsScreen').default,
  AccountEditor: require('./src/screens/AccountEditorScreen').default,
};

export default function App() {
 const [ready, setReady] = useState(false);

if (!ready) {
  (async () => {
    try {
      await runMigrations();
      const db = await getDb();
      const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
      console.log('DB tables:', tables.map(t => t.name));
    } catch (e) {
      console.warn('DB startup error', e);
    } finally {
      setReady(true);
    }
  })();
}


  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SplashAuth"
          screenOptions={{
            headerStyle: { backgroundColor: '#0B0D13' },
            headerTintColor: '#fff',
          }}
        >
          {Object.entries(screenRegistry).map(([name, Component]) => (
            <Stack.Screen
              key={name}
              name={name}
              component={Component}
              options={
                name === 'SplashAuth' || name === 'Login'
                  ? { headerShown: false }
                  : name === 'Dashboard'
                  ? { title: 'Dashboard' }
                  : ['Settings', 'Account', 'History', 'TxnEditor', 'Recurring', 'Budgets', 'ImportCsvScreen', 'Notifications'].includes(name)
                  ? { headerBackTitle: '' }
                  : name === 'AccountEditor'
                  ? { headerBackTitle: '' }
                  : undefined
              }
            />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
