import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

export default function HookSmokeTest() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setN((x) => x + 1), 1000);
    return () => clearTimeout(t);
  }, []);
  return <Text>ticks: {n}</Text>;
}
