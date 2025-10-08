// App.js
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider } from './src/state/AppState';

import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import ReportScreen from './src/screens/ReportScreen';
import HistoryScreen from './src/screens/HistoryScreen'; // if you added it

// ✅ MUST have parentheses here:
const Stack = createNativeStackNavigator();

function RootNavigator() {
  // Optional runtime guard: shows a hint if something is off
  if (!Stack || !Stack.Navigator || !Stack.Screen) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, textAlign: 'center' }}>
          Navigation stack is undefined. Check:
          {'\n'}1) const Stack = createNativeStackNavigator();
          {'\n'}2) Correct import from '@react-navigation/native-stack'
          {'\n'}3) Packages installed
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName="SplashAuth">
      <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
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
