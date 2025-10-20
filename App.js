import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';



const Stack = createNativeStackNavigator();

function Home({ navigation }) {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text onPress={() => navigation.navigate('Second')}>Go to Second</Text>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
