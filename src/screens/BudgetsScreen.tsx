// src/screens/BudgetsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const BudgetsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>Budgets</Text>
      <Text style={styles.subtle}>
        Budget tracking isn&apos;t wired up in this stable build yet.
        {'\n\n'}
        In a later phase, this screen will let you define monthly
        budgets by category (e.g. Groceries, Eating out, Transport)
        and compare your actual spending against those limits.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Planned features</Text>
        <Text style={styles.cardText}>
          • Set spending limits per category.{'\n'}
          • See how much you have left to spend this month.{'\n'}
          • Highlight categories that are close to or over budget.{'\n'}
          • Link budgets to the same categories used in Reports.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Reports' as never)}
        >
          <Text style={styles.primaryText}>View Reports</Text>
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
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 20,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardText: {
    color: '#9CA3AF',
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
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#E5E7EB',
    fontWeight: '500',
    fontSize: 14,
  },
});

export default BudgetsScreen;
