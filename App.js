// App.js
import 'react-native-gesture-handler';
import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// import AppProvider from './src/state/AppState';
// import { runMigrationsSafe as runMigrations } from './src/db/migrate';
// import { getDb } from './src/db/db';
// import DashboardScreen from './src/screens/DashboardScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = React.useState(true); // set to false if you run migrations

  // If you need migrations, uncomment this block:
  /*
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
  */

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  return (
    // <AppProvider>  // ← re-enable when your provider is ready
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Dashboard">
          <Stack.Screen
            name="Dashboard"
            options={{ title: 'Dashboard' }}
            getComponent={() => require('./src/screens/DashboardScreen').default}
          />
        </Stack.Navigator>
      </NavigationContainer>
    // </AppProvider>
  );
}
