// src/screens/DashboardScreen.js
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';

export default function DashboardScreen() {
  useEffect(() => {
    console.log('[DashboardScreen] mounted TEST');
    Alert.alert('Dashboard', 'Direct boot OK');
  }, []);
  return (
    <View style={styles.wrap}>
      <Text style={styles.huge}>DASHBOARD DIRECT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#ff00aa', alignItems: 'center', justifyContent: 'center' },
  huge: { color: 'white', fontSize: 28, fontWeight: '900' },
});
