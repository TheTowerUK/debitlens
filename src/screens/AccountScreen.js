// src/screens/AccountScreen.js (temporary minimal)
import React from 'react';
import { View, Text } from 'react-native';

export default function AccountScreen({ route, navigation }) {
  const accountId = route?.params?.accountId;

  if (!accountId) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text>No account selected.</Text>
      </View>
    );
  }

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: `Account: ${accountId}` });
  }, [navigation, accountId]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text>Account screen placeholder</Text>
      <Text style={{ marginTop: 8 }}>ID: {accountId}</Text>
    </View>
  );
}
