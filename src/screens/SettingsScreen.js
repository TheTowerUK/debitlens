// src/screens/SettingsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, Pressable, Alert, TextInput, Platform
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useApp } from '../state/AppState';

export default function SettingsScreen({ navigation }) {
  const { state, actions, setPin, clearPin } = useApp();
  const [bioCapable, setBioCapable] = useState(false);
  const [bioReason, setBioReason] = useState('');
  const [useBio, setUseBio] = useState(!!state?.prefs?.useBiometrics);
  const [theme, setTheme] = useState(state?.prefs?.theme || 'dark');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (alive) { setBioCapable(false); setBioReason('Biometrics not available on web'); }
          return;
        }
        const [hasHw, enrolled, supported] = await Promise.all([
          LocalAuthentication.hasHardwareAsync().catch(() => false),
          LocalAuthentication.isEnrolledAsync().catch(() => false),
          LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
        ]);
        const ok = hasHw && enrolled && (supported?.length ?? 0) > 0;
        if (alive) {
          setBioCapable(ok);
          if (!ok) setBioReason('No Face/Touch ID enrolled on this device');
        }
      } catch {
        if (alive) { setBioCapable(false); setBioReason('Error checking biometrics'); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggleBiometrics = async (val) => {
    if (val && !bioCapable) {
      return Alert.alert('Not available', bioReason || 'Biometrics not available on this device.');
    }
    setUseBio(val);
    await actions.updatePrefs({ useBiometrics: val });
  };

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await actions.updatePrefs({ theme: next });
  };

  const handleSavePin = async () => {
    const v = newPin.trim();
    if (!/^\d{4,6}$/.test(v)) {
      return Alert.alert('Invalid PIN', 'Enter a 4–6 digit PIN');
    }
    await setPin(v);
    setNewPin('');
    Alert.alert('PIN saved', 'Your PIN has been updated.');
  };

  const handleResetPin = async () => {
    await clearPin();
    Alert.alert('PIN cleared', 'Your PIN has been cleared. You can set a new one next time.');
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear all data?',
      'This removes all accounts and transactions stored locally.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await actions.clearAll();
            navigation.reset({ index: 0, routes: [{ name: 'SplashAuth' }] });
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    await actions.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.subtle}>Profile & preferences</Text>

      {/* Biometrics */}
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.label}>Use Face/Touch ID</Text>
          {!bioCapable && <Text style={styles.hint}>{bioReason}</Text>}
        </View>
        <Switch value={useBio} onValueChange={toggleBiometrics} disabled={!bioCapable} />
      </View>

      {/* Theme */}
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Theme</Text>
        <Pressable style={styles.pill} onPress={toggleTheme}>
          <Text style={styles.pillText}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
        </Pressable>
      </View>

      {/* PIN */}
      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>PIN</Text>
      <TextInput
        value={newPin}
        onChangeText={setNewPin}
        placeholder="New PIN (4–6 digits)"
        placeholderTextColor="#6B7280"
        keyboardType="number-pad"
        secureTextEntry
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable style={styles.btnSave} onPress={handleSavePin}>
          <Text style={styles.btnText}>Save PIN</Text>
        </Pressable>
        <Pressable style={styles.btnCancel} onPress={handleResetPin}>
          <Text style={styles.btnText}>Reset PIN</Text>
        </Pressable>
      </View>

      {/* Danger zone */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Danger Zone</Text>
      <Pressable style={[styles.btnDanger, { marginTop: 8 }]} onPress={handleClearAll}>
        <Text style={styles.btnText}>Clear All Local Data</Text>
      </Pressable>

      <Pressable style={[styles.btnSecondary, { marginTop: 12 }]} onPress={handleSignOut}>
        <Text style={styles.btnText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 24 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '700' },
  subtle: { color: '#9CA3AF', marginBottom: 16, marginTop: 4 },
  label: { color: '#E5E7EB', fontSize: 16, fontWeight: '600' },
  hint: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },

  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },

  pill: { backgroundColor: '#1F2937', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  pillText: { color: '#fff', fontWeight: '700' },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },

  sectionTitle: { color: '#E5E7EB', fontSize: 14, fontWeight: '700' },

  btnSave: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  btnCancel: { backgroundColor: '#374151', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, flex: 1, alignItems: 'center' },
  btnDanger: { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#6B7280', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
