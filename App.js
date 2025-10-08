// App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider, useApp } from './src/state/AppState';
import { initNotifications, rescheduleFromPrefs } from './src/utils/notifications';

// Screens
import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import ReportScreen from './src/screens/ReportScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

// Runs once at app start (under AppProvider) to set up notifications
function NotificationBootstrapper() {
  const { state } = useApp();
  useEffect(() => {
    (async () => {
      await initNotifications();
      await rescheduleFromPrefs(state?.prefs?.notifications);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once
  return null;
}

export default function App() {
  return (
    <AppProvider>
      {/* This must be inside AppProvider (so it can read state),
          but it does NOT need to be inside NavigationContainer */}
      <NotificationBootstrapper />

      <NavigationContainer>
        <StatusBar barStyle="light-content" />
        <Stack.Navigator initialRouteName="SplashAuth" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SplashAuth" component={SplashAuthScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="Report" component={ReportScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
