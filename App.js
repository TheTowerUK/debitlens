// App.js
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// App state/provider (keep your existing path/casing)
import { AppProvider, useApp } from './src/state/AppState';

// Screens (match your actual filenames)
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import ReportScreen from './src/screens/ReportScreen'; // <- singular, matches file

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { state } = useApp();

  // Defensive fallbacks so this works with your current AppState shape
  const isLoading =
    typeof state?.isLoading === 'boolean' ? state.isLoading : false;

  const isLoggedIn =
    typeof state?.isLoggedIn === 'boolean'
      ? state.isLoggedIn
      : !!state?.user; // if you store a user object

  // During splash/loading, show SplashScreen directly
  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator>
      {isLoggedIn ? (
        <>
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'Dashboard' }}
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={{ title: 'Account' }}
          />
          <Stack.Screen
            name="Report"
            component={ReportScreen}
            options={{ title: 'Reports' }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}
