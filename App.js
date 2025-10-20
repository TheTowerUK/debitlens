// App.js
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider } from './src/state/AppState';
import NotificationBootstrapper from './src/notifications/bootstrapper';
import RecurringBootstrapper from './src/recurring/bootstrapper';

import ReportListScreen from './src/screens/ReportListScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import ReportEditorScreen from './src/screens/ReportEditorScreen';
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

import { runMigrationsSafe } from './src/db/migrate';
import { getDb } from './src/db/db';

const Stack = createNativeStackNavigator();
const withBack = { headerBackTitleVisible: false };

export default function App() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        // tiny self-check so we see real SQL problems in Metro
        const db = await getDb();
        const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
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
      <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppProvider>
      <NotificationBootstrapper />
      <RecurringBootstrapper />
      <ErrorBoundary>
        <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SplashAuth"
          screenOptions={{ headerStyle:{ backgroundColor:'#0B0D13' }, headerTintColor:'#fff' }}
        >
          <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown:false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown:false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title:'Dashboard' }} />
          <Stack.Screen name="Account" component={AccountScreen} options={withBack} />
          <Stack.Screen name="TxnEditor" component={TxnEditorScreen} options={withBack} />
          <Stack.Screen name="History" component={HistoryScreen} options={withBack} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} options={withBack} />
          <Stack.Screen name="Recurring" component={RecurringScreen} options={withBack} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={withBack} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={withBack} />
          <Stack.Screen name="ImportCSV" component={ImportCsvScreen} options={{ title:'Import CSV' }} />
          <Stack.Screen name="Reports" component={ReportListScreen} />
          <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
          <Stack.Screen name="ReportEditor" component={ReportEditorScreen} />
        </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    </AppProvider>
  );
}
