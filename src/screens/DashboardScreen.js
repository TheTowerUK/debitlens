import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DashboardScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.huge}>DASHBOARD (NAV OK)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  huge: { color: 'white', fontSize: 26, fontWeight: '900' }
});
