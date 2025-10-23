// App.js
import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppState';
import NotificationBootstrapper from './src/notifications/bootstrapper';

import { runMigrationsSafe as runMigrations } from './src/db/migrate';
import { getDb } from './src/db/db';

const Stack = createNativeStackNavigator();

// Portable back-button option (hides long iOS back titles)
const withBack = { headerBackTitle: '' };

export default function App() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        // Optional: tiny self-check so SQL errors show in Metro
        const db = await getDb();
        const tables = await db.getAllAsync(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log('DB tables:', tables.map(t => t.name));
      } catch (e) {
        console.warn('DB startup error', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

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
      <NotificationBootstrapper />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SplashAuth"
          screenOptions={{ headerStyle: { backgroundColor: '#0B0D13' }, headerTintColor: '#fff' }}
        >
          {/* Auth / entry */}
          <Stack.Screen
            name="SplashAuth"
            options={{ headerShown: false }}
            getComponent={() => require('./src/screens/SplashAuthScreen').default}
          />
          <Stack.Screen
            name="Login"
            options={{ headerShown: false }}
            getComponent={() => require('./src/screens/LoginScreen').default}
          />

          {/* Main */}
          <Stack.Screen
            name="Dashboard"
            options={{ title: 'Dashboard' }}
            getComponent={() => require('./src/screens/DashboardScreen').default}
          />
          <Stack.Screen
            name="Account"
            options={withBack}
            getComponent={() => require('./src/screens/AccountScreen').default}
          />
          <Stack.Screen
            name="TxnEditor"
            options={withBack}
            getComponent={() => require('./src/screens/TxnEditorScreen').default}
          />
          <Stack.Screen
            name="History"
            options={withBack}
            getComponent={() => require('./src/screens/HistoryScreen').default}
          />
          <Stack.Screen
            name="Budgets"
            options={withBack}
            getComponent={() => require('./src/screens/BudgetsScreen').default}
          />
          <Stack.Screen
            name="Recurring"
            options={withBack}
            getComponent={() => require('./src/screens/RecurringScreen').default}
          />
          <Stack.Screen
            name="Settings"
            options={withBack}
            getComponent={() => require('./src/screens/SettingsScreen').default}
          />
          <Stack.Screen
            name="Notifications"
            options={withBack}
            getComponent={() => require('./src/screens/NotificationsScreen').default}
          />
          <Stack.Screen
            name="ImportCSV"
            options={{ title: 'Import CSV' }}
            getComponent={() => require('./src/screens/ImportCsvScreen').default}
          />

          {/* Reports */}
          <Stack.Screen
            name="Reports"
            getComponent={() => require('./src/screens/ReportListScreen').default}
          />
          <Stack.Screen
            name="ReportDetail"
            getComponent={() => require('./src/screens/ReportDetailScreen').default}
          />
          <Stack.Screen
            name="ReportEditor"
            getComponent={() => require('./src/screens/ReportEditorScreen').default}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
