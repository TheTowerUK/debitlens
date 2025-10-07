// src/screens/SplashAuthScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, TextInput, StyleSheet } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useApp } from '../state/AppState';

export default function SplashAuthScreen({ navigation }) {
  const { isHydrated, getPin, setPin } = useApp();
  const [mode, setMode] = useState('loading'); // loading | biometric | pin | setpin
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    console.log({ isHydratedAtMount: isHydrated });

    const decide = async () => {
      if (!isHydrated || cancelled) return;

      // safety timeout: if nothing decided in 2s, go to PIN flow
      const fallbackTimer = setTimeout(async () => {
        if (!cancelled && mode === 'loading') {
          const storedPin = await getPin().catch(() => null);
          setMode(storedPin ? 'pin' : 'setpin');
        }
      }, 2000);

      try {
        const [hasHardware, supported, enrolled, storedPin] = await Promise.all([
          LocalAuthentication.hasHardwareAsync().catch(() => false),
          LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
          LocalAuthentication.isEnrolledAsync().catch(() => false),
          getPin().catch(() => null),
        ]);

        if (!cancelled) {
          clearTimeout(fallbackTimer);
          if (hasHardware && enrolled && (supported?.length ?? 0) > 0) {
            setMode('biometric');
            const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock to view accounts' });
            if (res.success) {
              if (!cancelled) navigation.replace('Dashboard');
              return;
            }
          }
          // biometric failed or unavailable -> PIN path
          setMode(storedPin ? 'pin' : 'setpin');
        }
      } catch (e) {
        console.warn('Auth decide error', e);
        if (!cancelled) setMode('pin'); // last-resort fallback
      }
    };

    decide();
    return () => { cancelled = true; };
  }, [isHydrated]);

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
      navigation.replace('Dashboard');
    } else {
      setPinInput('');
      alert('Incorrect PIN');
    }
  };

  const savePin = async () => {
    const v = pinInput.trim();
    if (!/^\d{4,6}$/.test(v)) return alert('Enter a 4–6 digit PIN');
    await setPin(v);
    navigation.replace('Dashboard');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Secure Access</Text>
      <Text style={styles.subtle}>PIN or Face/Touch ID</Text>

      {mode === 'biometric' ? (
        <Pressable style={styles.primary} onPress={async () => {
          const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock' });
          if (res.success) navigation.replace('Dashboard');
          else {
            const stored = await getPin().catch(() => null);
            setMode(stored ? 'pin' : 'setpin');
          }
        }}>
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
          <Pressable style={styles.link} onPress={async () => {
            const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Use biometrics' });
            if (res.success) navigation.replace('Dashboard');
          }}>
            <Text style={styles.linkText}>Try Face/Touch ID</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex:1, backgroundColor:'#0B0D13', alignItems:'center', justifyContent:'center' },
  wrap: { flex:1, backgroundColor:'#0B0D13', padding:24, justifyContent:'center' },
  h1: { color:'#fff', fontSize:28, fontWeight:'700', marginBottom:8 },
  subtle: { color:'#9CA3AF', marginBottom:16 },
  input: { backgroundColor:'#0F172A', color:'#fff', borderColor:'#1F2937', borderWidth:1, borderRadius:10, padding:12, marginBottom:12 },
  primary: { backgroundColor:'#2563EB', borderRadius:10, paddingVertical:12, alignItems:'center' },
  primaryText: { color:'#fff', fontWeight:'700' },
  link: { alignItems:'center', marginTop:12 },
  linkText: { color:'#9CA3AF' }
});
