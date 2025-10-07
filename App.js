import { useEffect } from 'react';
import { View, Text, Alert, Platform } from 'react-native';

export default function App() {
  useEffect(() => {
    console.log('[App.js] mounted on', Platform.OS);
    Alert.alert('App.js loaded', `Platform: ${Platform.OS}`);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff00aa' }}>
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>HELLO FROM App.js</Text>
    </View>
  );
}
