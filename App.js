import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppState';
import { runMigrations } from './src/db/migrate';
import { getDb } from './src/db/db';

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="SplashAuth">
          <Stack.Screen
            name="SplashAuth"
            component={require('./src/screens/SplashAuthScreen').default}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
