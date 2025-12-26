// src/screens/RecurringEditorScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors as theme } from '../theme/colors';

const RecurringEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>Recurring (coming soon)</Text>
        <Text style={styles.subtle}>
          The recurring items editor is not wired up yet in this build.
          {'\n\n'}
          In the stable Option B base, recurring payments will be added in a
          later phase once the core accounts and transactions flow is fully
          locked in.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What this screen will do</Text>
          <Text style={styles.cardText}>
            • Create and edit recurring payments (e.g. rent, subscriptions).{'\n'}
            • Optionally set up recurring transfers between accounts.{'\n'}
            • Control frequency (monthly, weekly, etc.) and next due date.{'\n'}
            • Toggle items between active and paused.
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryText}>Back</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('Dashboard' as never)}
          >
            <Text style={styles.secondaryText}>Go to Dashboard</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 32,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 20,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardText: {
    color: theme.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: theme.cardAlt,
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

export default RecurringEditorScreen;
