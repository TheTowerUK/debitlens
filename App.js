// App.js — single-screen shell (no await, no bootstrappers, no DB)
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';

// ---- choose your first screen here ----
const START_SCREEN = 'Account'// change to 'Reports' or any route name below
// --------------------------------------


const Stack = createNativeStackNavigator();

const [ready, setReady] = React.useState(false);
React.useEffect(() => {
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
}, []);
if (!ready) {
    return (
      <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
        <ActivityIndicator size="large"/>
        <Text style={{ color: '#9CA3AF' }}>Loading…</Text>
      </View>
    );
  }

// inside a useEffect in App.js or bootstrapper
const sub = Notifications.addNotificationResponseReceivedListener((response) => {
  const screen = response.notification.request.content.data?.screen;
  if (screen) {
    // navigate to your Notifications screen
    // e.g., navRef.current?.navigate(screen);
  }
});
return () => sub.remove();

// Optional: hide iOS back title (portable)
const withBack = { headerBackTitle: '' };

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={START_SCREEN}
          screenOptions={{ headerStyle: { backgroundColor: '#0B0D13' }, headerTintColor: '#fff' }}
        >
          {/* Register ONE screen first (lazy loaded to avoid import-time crashes) */}
          <Stack.Screen
            name="Dashboard"
            options={{ title: 'Dashboard' }}
            getComponent={() => require('./src/screens/DashboardScreen').default}
          />

          {/* When Dashboard works, uncomment the next line, test, then continue incrementally */}
          <Stack.Screen
            name="Reports"
            options={{ title: 'Reports' }}
            getComponent={() => require('./src/screens/ReportListScreen').default}
          />
          
          <Stack.Screen
            name="History"
            options={{ title: 'History' }}
            getComponent={() => require('./src/screens/HistoryScreen').default}
          />

          <Stack.Screen
            name="Budgets"
            options={{ title: 'Budgets' }}
            getComponent={() => require('./src/screens/BudgetsScreen').default}
          />

          <Stack.Screen
            name="Recurring"
            options={{ title: 'Recurring' }}
            getComponent={() => require('./src/screens/RecurringScreen').default}
          />

          <Stack.Screen
            name="Settings"
            options={withBack}
            getComponent={() => require('./src/screens/SettingsScreen').default}
          />

          <Stack.Screen
            name="Notifications"
            options={{ title: 'Notifications' }}
            getComponent={() => require('./src/screens/NotificationsScreen').default}
          />

          <Stack.Screen
            name="Import"
            options={{ title: 'Import' }}
            getComponent={() => require('./src/screens/ImportCsvScreen').default}
          />

          <Stack.Screen
            name="ReportDetail"
            options={{ title: 'ReportDetail' }}
            getComponent={() => require('./src/screens/ReportDetailScreen').default}
          />

          <Stack.Screen
            name="ReportList"
            options={{ title: 'ReportList' }}
            getComponent={() => require('./src/screens/ReportListScreen').default}
          />


          <Stack.Screen
            name="Account"
            options={withBack}
            getComponent={() => require('./src/screens/AccountScreen').default}
          />

        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
