// App.js (minimal sanity template)
import 'react-native-gesture-handler'; // safe to keep even with native-stack
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';

// Quick test screens
function Home({ navigation }) {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text onPress={() => navigation.navigate('Second')}>Go to Second</Text>
    </View>
  );
}
function Second() {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text>Second screen</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator();

export default function App() {
  const [ready, setReady] = React.useState(true); // set true to bypass DB for this test

  React.useEffect(() => {
    console.log('has native stack?', typeof createNativeStackNavigator); // should be "function"
  }, []);

  if (!ready) {
    return (
      <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Second" component={Second} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
