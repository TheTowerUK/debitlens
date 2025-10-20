// App.js (only the relevant additions)
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { installGlobalHandlers } from './src/debug/installGlobalHandlers';
import HealthCheckScreen from './src/screens/HealthCheckScreen';
import { runMigrationsSafe } from './src/db/migrate';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';


// call as early as possible
installGlobalHandlers();

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try { await runMigrationsSafe(); }
      catch (e) { console.log('[Startup] migration error', e); }
      finally { setReady(true); }
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
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="HealthCheck"
          screenOptions={{ headerStyle:{ backgroundColor:'#0B0D13' }, headerTintColor:'#fff' }}
        >
          <Stack.Screen name="HealthCheck" component={HealthCheckScreen} />
          {/* keep the rest of your screens below */}
          <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown:false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown:false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title:'Dashboard' }} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="TxnEditor" component={TxnEditorScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} />
          <Stack.Screen name="Recurring" component={RecurringScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ImportCSV" component={ImportCsvScreen} options={{ title:'Import CSV' }} />
          <Stack.Screen name="Reports" component={ReportListScreen} />
          <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
          <Stack.Screen name="ReportEditor" component={ReportEditorScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
