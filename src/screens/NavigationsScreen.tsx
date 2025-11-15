// src/screens/NavigationsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export default function NotificationsScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.subtle}>
        Configure reminders and notification preferences (coming soon).
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>
        <Text style={styles.cardText}>
          Notifications are not yet configurable in this build.
        </Text>
        <Text style={styles.cardText}>
          You&apos;ll be able to enable daily/weekly reminders, budgeting alerts,
          and recurring item summaries here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: { color: '#9CA3AF', marginBottom: 16 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardText: { color: '#9CA3AF', fontSize: 14, marginBottom: 6 },
});
