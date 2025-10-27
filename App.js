import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

const DummyProvider = ({ children }) => <>{children}</>;

export default function App() {
  return (
    <DummyProvider>
      <TestReact />
    </DummyProvider>
  );
}


export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setCount(c => c + 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Count: {count}</Text>
    </View>
  );
}
