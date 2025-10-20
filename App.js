// App.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider } from './src/state/AppState';
import NotificationBootstrapper from './src/notifications/bootstrapper';
import RecurringBootstrapper from './src/recurring/bootstrapper';
import { db } from './src/db/db'; // <-- JS helper you created above

// Screens (use relative paths; avoid "@/..." unless you’ve set up a babel alias)
import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import TxnEditorScreen from './src/screens/TxnEditorScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import ImportCsvScreen from './src/screens/ImportCsvScreen';
import ReportListScreen from './src/screens/ReportListScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import { runMigrations } from './src/db/migrate';

import { getDb } from './src/db/db';

React.useEffect(() => {
  (async () => {
    try {
      await runMigrations();
      console.log('DB migrations complete');

      const db = await getDb();
      const tables = await db.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      console.log('DB tables:', tables.map(t => t.name));

      // Optional: confirm critical tables
      const check = async (name) => {
        const r = await db.getAllAsync(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          name
        );
        console.log(`Table ${name} present?`, r.length > 0);
      };
      await check('reports');
      await check('accounts');
      await check('transactions'); // this must already exist in your app
    } catch (e) {
      console.warn('DB startup error', e);
    }
  })();
}, []);


import ReportEditorScreen from './src/screens/ReportEditorScreen';

const Stack = createNativeStackNavigator();
const withBack = { headerBackTitleVisible: false };

export default function App() {
  React.useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        console.log('DB migrations complete');
      } catch (e) {
        console.warn('DB migration error', e);
      }
    })();
  }, []);

  return (
    <AppProvider>
      {/* Bootstrappers mount once, outside the navigator */}
      <NotificationBootstrapper />
      <RecurringBootstrapper />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SplashAuth"
          screenOptions={{
            headerStyle: { backgroundColor: '#0B0D13' },
            headerTintColor: '#fff',
          }}
        >
          <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
          <Stack.Screen name="Account" component={AccountScreen} options={withBack} />
          <Stack.Screen name="TxnEditor" component={TxnEditorScreen} options={withBack} />
          <Stack.Screen name="History" component={HistoryScreen} options={withBack} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} options={withBack} />
          <Stack.Screen name="Recurring" component={RecurringScreen} options={withBack} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={withBack} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={withBack} />
          <Stack.Screen name="ImportCSV" component={ImportCsvScreen} options={{ title: 'Import CSV' }} />
          <Stack.Screen
            name="Reports"
            component={ReportListScreen}
            options={({ navigation }) => ({
              title: 'Reports',
              headerRight: () => (
                <View style={{ flexDirection: 'row', marginRight: 8 }}>
                  <Pressable
                    onPress={() => navigation.navigate('TxnEditor', { mode: 'income' })}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginRight: 8 }}
                  >
                    <Text>Income</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('ReportEditor')}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10 }}
                  >
                    <Text>New</Text>
                  </Pressable>
                </View>
              ),
            })}
          />

          <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
          <Stack.Screen name="ReportEditor" component={ReportEditorScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
