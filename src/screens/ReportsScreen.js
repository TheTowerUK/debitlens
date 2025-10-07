import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReportsScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.h1}>Reports</Text>
      <Text style={styles.subtle}>Coming soon: trends per account, monthly in/out, charts…</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  page:{ flex:1, backgroundColor:'#0B0D13', padding:16 },
  h1:{ color:'#fff', fontSize:24, fontWeight:'700' },
  subtle:{ color:'#9CA3AF', marginTop:8 }
});
