// App.tsx
import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setCount(c => c + 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  console.log('App render, count =', count);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Minimal App OK: {count}</Text>
    </View>
  );
}
