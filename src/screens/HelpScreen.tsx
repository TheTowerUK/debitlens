// src/screens/HelpScreen.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as theme } from '../theme/colors';

export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Help & Guide</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Welcome & Orientation</Text>
          <Text style={styles.sectionText}>
            DebitLens is designed to be simple and steady. You can start small — even one account and a few
            transactions are enough. Nothing is locked in, and you can change or remove anything at any time.
          </Text>
          <Text style={styles.sectionText}>
            If a screen looks empty, it usually means there is nothing to show yet. Add an account or a few
            transactions and the app will begin to reflect your data.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Getting Started (Minimal Path)</Text>
          <Text style={styles.sectionText}>A simple three-step start:</Text>
          <Text style={styles.bullet}>• Add an account</Text>
          <Text style={styles.bullet}>• Add a transaction</Text>
          <Text style={styles.bullet}>• Return to the Dashboard</Text>
          <Text style={styles.sectionText}>
            If you already have data elsewhere, CSV import is often the fastest way to get started.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App Screens Overview</Text>
          <Text style={styles.sectionText}>
            Each screen has a clear focus. Use these as a quick guide:
          </Text>
          <Text style={styles.subsectionTitle}>Dashboard</Text>
          <Text style={styles.sectionText}>
            A snapshot of balances, recent activity, and upcoming items. Visit this to get your
            overall picture at a glance.
          </Text>
          <Text style={styles.subsectionTitle}>Accounts</Text>
          <Text style={styles.sectionText}>
            Your money sources (bank, cash, cards). Use this to see balance changes and account-specific activity.
          </Text>
          <Text style={styles.subsectionTitle}>Transactions</Text>
          <Text style={styles.sectionText}>
            The history of income, expenses, and transfers. Use this to review, edit, or add entries.
          </Text>
          <Text style={styles.subsectionTitle}>Recurring Payments</Text>
          <Text style={styles.sectionText}>
            Scheduled items like subscriptions, rent, or regular income. Use this to plan and track repeating activity.
          </Text>
          <Text style={styles.subsectionTitle}>Import & Export</Text>
          <Text style={styles.sectionText}>
            Tools for bringing data in or backing it up. Use this for CSV import and data export.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Common Questions</Text>
          <Text style={styles.subsectionTitle}>Why does the Dashboard look empty?</Text>
          <Text style={styles.sectionText}>
            The Dashboard reflects your data. Add accounts and transactions to see totals and recent activity.
          </Text>
          <Text style={styles.subsectionTitle}>Can I edit data later?</Text>
          <Text style={styles.sectionText}>
            Yes. Accounts, transactions, and recurring items can be edited or removed at any time.
          </Text>
          <Text style={styles.subsectionTitle}>Where is my data stored?</Text>
          <Text style={styles.sectionText}>
            Data is stored locally on your device. Use Export to back it up.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Future Guidance</Text>
          <Text style={styles.sectionText}>
            More in-app guidance will be added in future versions. This Help & Guide screen is the
            stable reference point for that guidance.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  wrap: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  h1: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  subsectionTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  sectionText: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  bullet: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
});
