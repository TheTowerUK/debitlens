// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider } from './src/state/AppState';
import NotificationBootstrapper from './src/notifications/bootstrapper';

// Screens
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

const Stack = createNativeStackNavigator();

// Reusable back button option
const withBack = { headerBackTitleVisible: false };

export default function App() {
  return (
    // ✅ Provider wraps the whole app — NOT inside a navigator
    <AppProvider>
      {/* ✅ This mounts once; not a child of Stack.Navigator */}
      <NotificationBootstrapper />

      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="SplashAuth"
          screenOptions={{ headerStyle: { backgroundColor: '#0B0D13' }, headerTintColor: '#fff' }}
        >
          {/* ✅ Only Screen/Group/Fragment as direct children of the navigator */}
          <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
          <Stack.Screen name="Account" component={AccountScreen} options={withBack} />
          <Stack.Screen name="TxnEditor" component={TxnEditorScreen} options={withBack} />
          <Stack.Screen name="History" component={HistoryScreen} options={withBack} />
          <Stack.Screen name="Report" component={ReportScreen} options={withBack} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} options={withBack} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={withBack} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={withBack} />
          <Stack.Screen name="TxnEditor" component={TxnEditorScreen} options={withBack} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
