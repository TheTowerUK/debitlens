// src/TestReact.tsx
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

export default function TestReact() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setCount(c => c + 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>React is working: {count}</Text>
    </View>
  );
}
