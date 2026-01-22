// src/screens/SplashAuthScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import { colors as theme } from '../theme/colors';

const STORAGE_KEY_BIOMETRICS = '@debitlens/biometricsEnabled:v1';

// Route key in RootStackParamList should be 'Login'
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function SplashAuthScreen({ navigation }: Props) {
  const { getPin, setPin } = useApp();

  // Use simple string modes: 'loading' | 'sign' | 'pin'
  const [mode, setMode] = useState<string>('loading');
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [biometricsUnavailableHint, setBiometricsUnavailableHint] = useState<string | null>(null);
  const biometricAttempted = useRef(false);

  // Authoritative: compute once at render
  const storedPin = (getPin() ?? '').trim();
  const pinExists = storedPin.length > 0;

  // Mode must follow PIN existence (no userChoseCreateMode when PIN exists)
  useEffect(() => {
    if (pinExists) setMode('sign');
    else setMode('pin');
  }, [pinExists]);

  // Attempt biometric authentication when mode becomes 'sign' and biometrics enabled
  useEffect(() => {
    if (mode !== 'sign' || !pinExists) return;

    if (biometricAttempted.current) return; // Already attempted this session

    let mounted = true;
    (async () => {
      try {
        const biometricsEnabledRaw = await AsyncStorage.getItem(STORAGE_KEY_BIOMETRICS);
        const biometricsEnabled = biometricsEnabledRaw === 'true';

        if (!biometricsEnabled || !mounted) return;

        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        if (!mounted) return;

        const available = !!hasHardware && !!isEnrolled;
        biometricAttempted.current = true; // Don't keep trying (prompt or skip)

        if (!available) {
          if (mounted) setBiometricsUnavailableHint('Face ID / Biometrics is enabled but not available on this device.');
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock DebitLens',
          fallbackLabel: 'Use PIN',
        });

        if (mounted && result.success) {
          navigation.replace('Dashboard');
        }
        // If fail/cancel, stay on PIN entry screen (no crash)
      } catch (e) {
        console.warn('[SplashAuth] biometric auth error', e);
        biometricAttempted.current = true; // Don't retry on error
      }
    })();

    return () => { mounted = false; };
  }, [mode, pinExists, navigation]);

  const onSignIn = () => {
    const entered = pin.trim();
    if (storedPin && entered === storedPin) {
      setPinError('');
      navigation.replace('Dashboard');
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const onSavePin = () => {
    const p1 = pin.trim();
    const p2 = confirm.trim();

    if (!/^\d{4,6}$/.test(p1)) {
      return Alert.alert('Invalid PIN', 'Enter 4–6 digits.');
    }
    if (p1 !== p2) {
      return Alert.alert('Mismatch', 'PINs do not match.');
    }

    biometricAttempted.current = false; // Clear when PIN changes (e.g. before navigate)
    setPin(p1);
    setPinError('');
    navigation.replace('Dashboard');
  };

  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>Preparing…</Text>
      </View>
    );
  }

  const isValidPin = /^\d{4,6}$/.test(pin.trim());
  const isSignMode = mode === 'sign';

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Welcome</Text>
      <Text style={styles.subtle}>
        {isSignMode
          ? 'Enter your PIN to continue'
          : 'Create a PIN for quick access'}
      </Text>

      {isSignMode ? (
        <>
          <TextInput
            value={pin}
            onChangeText={(value) => {
              setPinInput(value);
              if (pinError) setPinError(''); // clear error on change
            }}
            placeholder="PIN (4–6 digits)"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          {/* Inline error pill */}
          {pinError ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{pinError}</Text>
            </View>
          ) : null}

          {biometricsUnavailableHint ? (
            <Text style={styles.hint}>{biometricsUnavailableHint}</Text>
          ) : null}

          <Pressable
            style={[styles.primary, !isValidPin && { opacity: 0.5 }]}
            onPress={onSignIn}
            disabled={!isValidPin}
          >
            <Text style={styles.primaryText}>Sign In</Text>
          </Pressable>
          {/* No "Set / Change PIN" when pinExists: mode must stay 'sign', no create mode */}
        </>
      ) : (
        <>
          <TextInput
            value={pin}
            onChangeText={(value) => {
              setPinInput(value);
              if (pinError) setPinError('');
            }}
            placeholder="New PIN (4–6 digits)"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm PIN"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          <Pressable
            style={[styles.primary, (!isValidPin || !confirm.trim()) && { opacity: 0.5 }]}
            onPress={onSavePin}
            disabled={!isValidPin || confirm.trim().length === 0}
          >
            <Text style={styles.primaryText}>Save PIN</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 32,
  },
  center: {
    flex: 1,
    backgroundColor: '#0B0D13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  primary: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  hint: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  errorPill: {
    backgroundColor: '#7F1D1D',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  errorText: {
    color: '#FEE2E2',
    fontSize: 13,
    fontWeight: '500',
  },
});
