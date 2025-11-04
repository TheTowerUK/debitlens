// src/screens/SplashAuthScreen.js (diagnostic)
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useApp } from '../state/AppProvider';

export default function SplashAuthScreen({ navigation }) {
  const { isHydrated, getPin, setPin } = useApp();
  const [mode, setMode] = React.useState('loading'); // loading | biometric | pin | setpin
  const [pinInput, setPinInput] = React.useState('');
  const [debug, setDebug] = React.useState({ hydrated: false, storedPin: null, canBiometric: null });

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        console.log('[Splash] isHydrated=', isHydrated);
        if (!isHydrated) { setMode('loading'); return; }

        const stored = await getPin().catch(() => null);
        let canBiometric = false;
        if (Platform.OS !== 'web') {
          const [hasHw, enrolled, supported] = await Promise.all([
            LocalAuthentication.hasHardwareAsync().catch(() => false),
            LocalAuthentication.isEnrolledAsync().catch(() => false),
            LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
          ]);
          canBiometric = !!(hasHw && enrolled && (supported?.length ?? 0) > 0);
        }

        if (cancelled) return;
        setDebug({ hydrated: isHydrated, storedPin: stored ? 'yes' : 'no', canBiometric });

        if (canBiometric) {
          setMode('biometric');
          return; // wait for user to tap the button
        }
        setMode(stored ? 'pin' : 'setpin');
      } catch (e) {
        console.log('[Splash] error deciding mode', e);
        setMode('pin');
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isHydrated, getPin]);

  // Minimal UI
  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.subtle}>Preparing… (hydrated: {String(isHydrated)})</Text>
        <Pressable onPress={() => navigation.replace('Dashboard')} style={styles.linkBtn}>
          <Text style={styles.linkTxt}>Skip to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Secure Access</Text>
      <Text style={styles.subtle}>
        mode={mode} • hydrated={String(debug.hydrated)} • pin={debug.storedPin} • biometrics={String(debug.canBiometric)}
      </Text>

      {mode === 'biometric' ? (
        <Pressable
          style={styles.primary}
          onPress={async () => {
            try {
              const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock' });
              if (res.success) {
                navigation.replace('Dashboard');
              } else {
                const stored = await getPin().catch(() => null);
                setMode(stored ? 'pin' : 'setpin');
              }
            } catch {
              const stored = await getPin().catch(() => null);
              setMode(stored ? 'pin' : 'setpin');
            }
          }}
        >
          <Text style={styles.primaryText}>Use Face/Touch ID</Text>
        </Pressable>
      ) : (
        <>
          <TextInput
            value={pinInput}
            onChangeText={setPinInput}
            keyboardType="number-pad"
            placeholder={mode === 'setpin' ? 'Create PIN (4–6 digits)' : 'Enter PIN'}
            placeholderTextColor="#6B7280"
            secureTextEntry
            style={styles.input}
          />
          {mode === 'pin' && (
            <Pressable
              style={styles.primary}
              onPress={async () => {
                const stored = await getPin().catch(() => null);
                if (stored && stored === pinInput.trim()) {
                  navigation.replace('Dashboard');
                } else {
                  setPinInput('');
                  alert('Incorrect PIN');
                }
              }}
            >
              <Text style={styles.primaryText}>Unlock</Text>
            </Pressable>
          )}
          {mode === 'setpin' && (
            <Pressable
              style={styles.primary}
              onPress={async () => {
                const v = pinInput.trim();
                if (!/^\d{4,6}$/.test(v)) { alert('Enter a 4–6 digit PIN'); return; }
                await setPin(v);
                navigation.replace('Dashboard');
              }}
            >
              <Text style={styles.primaryText}>Save PIN</Text>
            </Pressable>
          )}
        </>
      )}

      <Pressable onPress={() => navigation.replace('Dashboard')} style={[styles.linkBtn, { marginTop: 16 }]}>
        <Text style={styles.linkTxt}>Skip to Dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0B0D13', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 24, justifyContent: 'center' },
  h1: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtle: { color: '#9CA3AF', marginBottom: 16 },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12
  },
  primary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  linkBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, borderColor: '#1F2937' },
  linkTxt: { color: '#E5E7EB' }
});
