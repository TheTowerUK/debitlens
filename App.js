// App.js
import React from 'react';
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
import ReportScreen from './src/screens/ReportScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import ImportCsvScreen from './src/screens/ImportCsvScreen';
import ReportListScreen from './src/screens/ReportListScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';

const Stack = createNativeStackNavigator();
const withBack = { headerBackTitleVisible: false };
console.log('has openDatabase?', typeof SQLite.openDatabase); // should be "function"

export default function App() {
  // Tiny SQLite sanity check: create a table, insert one row, read it back
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
          <Stack.Screen name="Report" component={ReportScreen} options={withBack} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} options={withBack} />
          <Stack.Screen name="Recurring" component={RecurringScreen} options={withBack} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={withBack} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={withBack} />
          <Stack.Screen name="ImportCSV" component={ImportCsvScreen} options={{ title: 'Import CSV' }} />
          <Stack.Screen name="Reports" component={ReportListScreen} />
          <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
