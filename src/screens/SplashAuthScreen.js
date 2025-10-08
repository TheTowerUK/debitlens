// src/screens/SplashAuthScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useApp } from '../state/AppState';

const BIOMETRIC_TIMEOUT_MS = 4000;
const FAILSAFE_NAV_MS      = 8000;

export default function SplashAuthScreen({ navigation }) {
  const { state, isHydrated, getPin, setPin } = useApp();
  const [mode, setMode] = useState('loading'); // 'loading' | 'biometric' | 'pin' | 'setpin'
  const [pinInput, setPinInput] = useState('');

  const failsafeRef = useRef(null);
  const didNavigate = useRef(false);
  const cancelledRef = useRef(false);

  const allowBiometrics = !!state?.prefs?.useBiometrics;

  const safeReset = (routeName) => {
    if (didNavigate.current) return;
    didNavigate.current = true;
    navigation.reset({ index: 0, routes: [{ name: routeName }] });
  };

  useEffect(() => {
    cancelledRef.current = false;

    const goDashboard = () => {
      if (!cancelledRef.current) safeReset('Dashboard');
    };

    const decide = async () => {
      if (!isHydrated || cancelledRef.current) return;

      if (!failsafeRef.current) {
        failsafeRef.current = setTimeout(goDashboard, FAILSAFE_NAV_MS);
      }

      try {
        if (Platform.OS === 'web') {
          const stored = await getPin().catch(() => null);
          setMode(stored ? 'pin' : 'setpin');
          return;
        }

        const storedPin = await getPin().catch(() => null);

        // Biometric capability
        const [hasHw, enrolled, supported] = await Promise.all([
          LocalAuthentication.hasHardwareAsync().catch(() => false),
          LocalAuthentication.isEnrolledAsync().catch(() => false),
          LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
        ]);

        const canBiometric = allowBiometrics && hasHw && enrolled && (supported?.length ?? 0) > 0;

        if (canBiometric) {
          setMode('biometric');

          const result = await Promise.race([
            LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock to view accounts' }),
            new Promise(resolve => setTimeout(() => resolve({ success: false, timeout: true }), BIOMETRIC_TIMEOUT_MS)),
          ]);

          if (!cancelledRef.current && result?.success) {
            if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
            return goDashboard();
          }

          setMode(storedPin ? 'pin' : 'setpin');
          return;
        }

        // No biometrics (or disabled) → PIN flow
        setMode(storedPin ? 'pin' : 'setpin');
      } catch {
        setMode('pin');
      }
    };

    decide();

    return () => {
      cancelledRef.current = true;
      if (failsafeRef.current) {
        clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
    };
  }, [isHydrated, allowBiometrics, getPin, navigation]);

  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.subtle}>Preparing…</Text>
      </View>
    );
  }

  const submitPin = async () => {
    const stored = await getPin().catch(() => null);
    if (stored === pinInput.trim()) {
      if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
      safeReset('Dashboard');
    } else {
      setPinInput('');
      alert('Incorrect PIN');
    }
  };

  const savePin = async () => {
    const v = pinInput.trim();
    if (!/^\d{4,6}$/.test(v)) return alert('Enter a 4–6 digit PIN');
    await setPin(v);
    if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
    safeReset('Dashboard');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Secure Access</Text>
      <Text style={styles.subtle}>
        {allowBiometrics ? 'PIN or Face/Touch ID' : 'PIN (biometrics disabled in Settings)'}
      </Text>

      {mode === 'biometric' ? (
        <Pressable
          style={styles.primary}
          onPress={async () => {
            const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock' });
            if (res.success) {
              if (failsafeRef.current) { clearTimeout(failsafeRef.current); failsafeRef.current = null; }
              safeReset('Dashboard');
            } else {
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
            <Pressable style={styles.primary} onPress={submitPin}>
              <Text style={styles.primaryText}>Unlock</Text>
            </Pressable>
          )}
          {mode === 'setpin' && (
            <Pressable style={styles.primary} onPress={savePin}>
              <Text style={styles.primaryText}>Save PIN</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0B0D13', alignItems: 'center', justifyContent: 'center' },
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
  primaryText: { color: '#fff', fontWeight: '700' }
});
