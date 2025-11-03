import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import HookSmokeTest from './src/HookSmokeTest';

export default function App() {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('React identity', React, 'version', (React as any)?.version);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Hook test — check Metro console for "React identity"</Text>
    </View>
  );
}
