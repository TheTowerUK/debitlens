// App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import Constants from 'expo-constants';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider, useApp } from './src/state/AppState';
import { initNotifications, rescheduleFromPrefs } from './src/utils/notifications';

// Screens…
import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import ReportScreen from './src/screens/ReportScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

function NotificationBootstrapper() {
  const { state } = useApp();
  useEffect(() => {
    const inExpoGo = Constants.appOwnership === 'expo';

    // Skip only Android-on-Expo-Go (noisy + limited support)
    if (inExpoGo && Platform.OS === 'android') {
      console.log('[notifications] Skipping setup on Android Expo Go');
      return;
    }

    (async () => {
      await initNotifications();
      await rescheduleFromPrefs(state?.prefs?.notifications);
    })();
  }, [state?.prefs?.notifications]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      {/* Must be inside AppProvider so it can read state */}
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
