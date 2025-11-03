// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AppProvider from './src/state/AppProvider';

//import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
//import DashboardScreen from './src/screens/DashboardScreen';

const Stack = createNativeStackNavigator();

//console.log('typeof LoginScreen:', typeof LoginScreen);
console.log('typeof SettingsScreen:', typeof SettingsScreen);
//console.log('typeof DashboardScreen:', typeof DashboardScreen);

function DummyScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Dummy screen OK</Text>
    </View>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Dummy">
          {/* Keep only Dummy for now so the app still runs */}
          <Stack.Screen name="Dummy" component={DummyScreen} />
          
          {/*
          Later, once we see the console logs, we can enable these one by one:

          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          */}
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}


