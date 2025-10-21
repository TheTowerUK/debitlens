// App.js — single-screen shell (no await, no bootstrappers, no DB)
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';

// ---- choose your first screen here ----
const START_SCREEN = 'Settings'; // change to 'Reports' or any route name below
// --------------------------------------

const Stack = createNativeStackNavigator();

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
            options={{ title: 'Settings' }}
            getComponent={() => require('./src/screens/SettingsScreen').default}
          />

          {/* Example of a detail screen when you’re ready */}
          {/*
          <Stack.Screen
            name="Account"
            options={withBack}
            getComponent={() => require('./src/screens/AccountScreen').default}
          />
          */}
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
