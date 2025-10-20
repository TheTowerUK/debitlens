import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';



const Stack = createNativeStackNavigator();

function HomeTest({ navigation }) {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 16 }}>Isolation Start</Text>
      <Text onPress={() => navigation.navigate('Second')} style={{ textDecorationLine: 'underline', marginBottom: 12 }}>
        Go to Second
      </Text>
      <Text onPress={() => navigation.navigate('Dashboard')} style={{ textDecorationLine: 'underline' }}>
        Go to Dashboard
      </Text>
    </View>
  );
}
function Second() { return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Second</Text></View>; }

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Second" component={Second} />
        <Stack.Screen name="Dashboard" getComponent={() => require('./src/screens/DashboardScreen').default} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
