// App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import Constants from 'expo-constants';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider, useApp } from './src/state/AppState';
import { initNotifications, rescheduleFromPrefs } from './src/utils/notifications';

import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import ReportScreen from './src/screens/ReportScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import TransactionEditor from './src/screens/TransactionEditor';

const Stack = createNativeStackNavigator();

// Skip Android Expo Go notifications setup; enable elsewhere
function NotificationBootstrapper() {
  const { state } = useApp();
  useEffect(() => {
    const inExpoGo = Constants.appOwnership === 'expo';
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

// Common header options that show a back arrow
const withBack = {
  headerShown: true,
  headerTitle: '',
  headerBackTitleVisible: false,
  headerTintColor: '#fff',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#0B0D13' },
  // If you prefer the back arrow overlaying content instead of pushing it down, use:
  // headerTransparent: true,
};

export default function App() {
  return (
    <AppProvider>
      <NotificationBootstrapper />
      <NavigationContainer>
        <StatusBar barStyle="light-content" />
        <Stack.Navigator initialRouteName="SplashAuth" screenOptions={{ headerShown: false }}>
          {/* Root / no back */}
          <Stack.Screen name="SplashAuth" component={SplashAuthScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />

          {/* Screens with back button */}
          <Stack.Screen name="Account" component={AccountScreen} options={withBack} />
          <Stack.Screen name="Report" component={ReportScreen} options={withBack} />
          <Stack.Screen name="History" component={HistoryScreen} options={withBack} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={withBack} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={withBack} />
          <Stack.Screen name="TxnEditor" component={TransactionEditor} options={withBack} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
