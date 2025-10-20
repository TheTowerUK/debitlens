import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';



const Stack = createNativeStackNavigator();


function Second() { return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Second</Text></View>; }

export default function App() {
  return (
<NavigationContainer>
  <Stack.Navigator initialRouteName="SplashAuth" screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="SplashAuth"
      getComponent={() => require('./src/screens/SplashAuthScreen').default}
    />
    <Stack.Screen
      name="Login"
      getComponent={() => require('./src/screens/LoginScreen').default}
    />
    <Stack.Screen
      name="Dashboard"
      options={{ headerShown: true, title: 'Dashboard' }}
      getComponent={() => require('./src/screens/DashboardScreen').default}
    />
    {/* ...other screens */}
  </Stack.Navigator>
</NavigationContainer>

  );
}
