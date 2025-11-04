// src/screens/DashboardScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.subtle}>
        Dashboard placeholder. Accounts, balances, and reports will appear here.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick actions</Text>

        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.btnText}>Go to Settings</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
          onPress={() => navigation.navigate('ImportCSV')}
        >
          <Text style={styles.btnText}>Import from CSV</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Coming soon</Text>
        <Text style={styles.body}>• Accounts and balances</Text>
        <Text style={styles.body}>• Recent transactions</Text>
        <Text style={styles.body}>• Quick links to reports, budgets, and more</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtle: { color: '#9CA3AF', marginBottom: 16 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  body: { color: '#E5E7EB', marginTop: 4 },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: '#1F2937' },
  btnText: { color: '#fff', fontWeight: '700' },
});
