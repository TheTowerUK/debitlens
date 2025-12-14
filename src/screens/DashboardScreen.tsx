// src/screens/DashboardScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useApp } from '../state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      {/* ---------- Header with SETTINGS pill ---------- */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>Dashboard</Text>
          <Text style={styles.subtle}>
            Overview of your accounts & activity
          </Text>
        </View>

        <Pressable
          style={styles.settingsPill}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsPillText}>Settings</Text>
        </Pressable>
      </View>

      {/* ---------- Accounts Summary ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Accounts</Text>
        <Text style={styles.cardValue}>{accounts.length}</Text>

        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('AddAccount')}
        >
          <Text style={styles.cardBtnText}>Add Account</Text>
        </Pressable>

        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('Payments')}
        >
          <Text style={styles.cardBtnText}>View Payments</Text>
        </Pressable>

        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('RecentActivity')}
        >
          <Text style={styles.cardBtnText}>Recent Activity</Text>
        </Pressable>
      </View>

      {/* ---------- Recurring ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recurring Payments</Text>
        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('Recurring')}
        >
          <Text style={styles.cardBtnText}>Manage Recurring</Text>
        </Pressable>
      </View>

      {/* ---------- Budget ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budgets</Text>
        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('Budgets')}
        >
          <Text style={styles.cardBtnText}>Budget Overview</Text>
        </Pressable>
      </View>

      {/* ---------- Reports ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reports</Text>
        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('Reports')}
        >
          <Text style={styles.cardBtnText}>View Reports</Text>
        </Pressable>
      </View>

      {/* ---------- Notifications ---------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <Pressable
          style={styles.cardBtn}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.cardBtnText}>Open Notifications</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#050816',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  h1: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },

  // SETTINGS PILL
  settingsPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  settingsPillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },

  // CARDS
  card: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardValue: {
    color: '#F97316',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },

  // BUTTONS INSIDE CARDS
  cardBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardBtnText: {
    color: '#E5E7EB',
    fontWeight: '600',
    textAlign: 'center',
  },
});
