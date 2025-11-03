// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppProvider';

const Stack = createNativeStackNavigator();

function DummyScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Dummy screen OK</Text>
    </View>
  );
}

function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <Text>Root OK</Text>
        </View>
      </NavigationContainer>
    </AppProvider>
  );
}

export default App;
