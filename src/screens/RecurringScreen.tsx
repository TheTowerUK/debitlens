// src/screens/RecurringScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const RecurringScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>Recurring payments</Text>
      <Text style={styles.subtle}>
        Recurring payments and transfers are not wired up yet in this
        stable build.
        {'\n\n'}
        In a later phase, this screen will show your scheduled items
        (e.g. rent, subscriptions, regular transfers) and let you
        quickly apply anything that&apos;s due.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Planned features</Text>
        <Text style={styles.cardText}>
          • Create recurring expenses and income (e.g. rent, salary).{'\n'}
          • Set up recurring transfers between accounts.{'\n'}
          • Choose frequency (daily, weekly, monthly, yearly).{'\n'}
          • Track next due date and status (active / paused).{'\n'}
          • Apply all due items to create real transactions.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('RecurringEditor' as never)}
        >
          <Text style={styles.primaryText}>Open Recurring editor</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Dashboard' as never)}
        >
          <Text style={styles.secondaryText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtle: {
    color: '#9ca3af',
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 6,
  },
  cardText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#e5e7eb',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default RecurringScreen;
