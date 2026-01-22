// src/screens/NotificationsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';

import { colors as theme } from '../theme/colors';

export default function NotificationsScreen() {
  // Local UI state for now – avoids relying on missing AppState/AppActions fields
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.subtle}>Control how DebitLens keeps you in the loop.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Push notifications</Text>
            <Text style={styles.caption}>Transaction alerts and balance changes.</Text>
          </View>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Email summaries</Text>
            <Text style={styles.caption}>Optional weekly snapshot to your inbox.</Text>
          </View>
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Reminders</Text>
            <Text style={styles.caption}>Gentle nudges for upcoming bills and goals.</Text>
          </View>
          <Switch value={remindersEnabled} onValueChange={setRemindersEnabled} />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Notification behaviour can vary slightly on {Platform.OS === 'android' ? 'Android' : 'iOS'} devices.
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
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: theme.cardAlt,
    marginVertical: 6,
  },
  infoBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  infoText: {
    color: theme.textDim,
    fontSize: 13,
  },
});
