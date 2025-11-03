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

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Dummy">
          <Stack.Screen name="Dummy" component={DummyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
