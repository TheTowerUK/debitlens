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
import * as LocalAuthentication from 'expo-local-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import { colors as theme } from '../theme/colors';
import {
  clearSecurityOnPinRemove,
  loadSecuritySettings,
  markUnlockedNow,
} from '../utils/settingsStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

type ScreenMode = 'loading' | 'sign' | 'create' | 'changeCurrent' | 'changeNew' | 'remove';

export default function SplashAuthScreen({ navigation, route }: Props) {
  const { getPin, setPin } = useApp();
  const flow = route.params?.flow;

  const [mode, setMode] = useState<ScreenMode>('loading');
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [biometricsUnavailableHint, setBiometricsUnavailableHint] = useState<string | null>(null);
  const biometricAttempted = useRef(false);

  const storedPin = (getPin() ?? '').trim();
  const pinExists = storedPin.length > 0;

  useEffect(() => {
    if (flow === 'change') {
      setMode(pinExists ? 'changeCurrent' : 'create');
      return;
    }
    if (flow === 'remove') {
      setMode(pinExists ? 'remove' : 'create');
      return;
    }
    if (flow === 'create' || !pinExists) {
      setMode('create');
      return;
    }
    setMode('sign');
  }, [flow, pinExists]);

  const finishUnlock = async (destination: 'Dashboard' | 'Settings' = 'Dashboard') => {
    await markUnlockedNow();
    if (destination === 'Settings') {
      navigation.replace('Settings');
      return;
    }
    navigation.replace('Dashboard');
  };

  useEffect(() => {
    if (mode !== 'sign' || !pinExists) return;
    if (biometricAttempted.current) return;

    let mounted = true;
    (async () => {
      try {
        const security = await loadSecuritySettings();
        if (!security.biometricsEnabled || !mounted) return;

        const [hasHardware, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        if (!mounted) return;
        biometricAttempted.current = true;

        if (!hasHardware || !isEnrolled) {
          setBiometricsUnavailableHint(
            'Biometrics is enabled but not available. Enter your PIN instead.'
          );
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock DebitLens',
          fallbackLabel: 'Use PIN',
        });

        if (mounted && result.success) {
          await finishUnlock('Dashboard');
        }
      } catch (e) {
        console.warn('[SplashAuth] biometric auth error', e);
        biometricAttempted.current = true;
      }
    })();

    return () => {
      mounted = false;
    };
  }, [mode, pinExists, navigation]);

  const onSignIn = () => {
    const entered = pin.trim();
    if (storedPin && entered === storedPin) {
      setPinError('');
      void finishUnlock('Dashboard');
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  };

  const onVerifyCurrentPin = (): boolean => {
    const entered = pin.trim();
    if (entered !== storedPin) {
      setPinError('Incorrect PIN. Please try again.');
      setPinInput('');
      return false;
    }
    setPinError('');
    return true;
  };

  const onSaveNewPin = () => {
    const p1 = pin.trim();
    const p2 = confirm.trim();

    if (!/^\d{4,6}$/.test(p1)) {
      return Alert.alert('Invalid PIN', 'Enter 4–6 digits.');
    }
    if (p1 !== p2) {
      return Alert.alert('Mismatch', 'PINs do not match.');
    }

    biometricAttempted.current = false;
    setPin(p1);
    setPinInput('');
    setConfirm('');
    setPinError('');
    void finishUnlock(flow === 'change' ? 'Settings' : 'Dashboard');
  };

  const onChangePinContinue = () => {
    if (!onVerifyCurrentPin()) return;
    setPinInput('');
    setMode('changeNew');
  };

  const onRemovePinConfirm = async () => {
    if (!onVerifyCurrentPin()) return;

    Alert.alert(
      'Remove PIN',
      'Your PIN and biometric unlock will be turned off. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove PIN',
          style: 'destructive',
          onPress: async () => {
            biometricAttempted.current = false;
            setPin(null);
            await clearSecurityOnPinRemove();
            setPinInput('');
            setConfirm('');
            setPinError('');
            navigation.replace('Settings');
          },
        },
      ]
    );
  };

  const performPinReset = async () => {
    biometricAttempted.current = false;
    setPin(null);
    await clearSecurityOnPinRemove();
    setPinInput('');
    setConfirm('');
    setPinError('');
    setBiometricsUnavailableHint(null);
  };

  const onForgotPin = () => {
    Alert.alert(
      'Reset PIN',
      'This will remove your PIN on this device. You will need to set a new PIN to continue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const security = await loadSecuritySettings();
              if (!security.biometricsEnabled) {
                await performPinReset();
                setMode('create');
                return;
              }

              const [hasHardware, isEnrolled] = await Promise.all([
                LocalAuthentication.hasHardwareAsync(),
                LocalAuthentication.isEnrolledAsync(),
              ]);

              if (!hasHardware || !isEnrolled) {
                await performPinReset();
                setMode('create');
                return;
              }

              const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirm to reset PIN',
                fallbackLabel: 'Use PIN',
              });

              if (result.success) {
                await performPinReset();
                setMode('create');
              }
            } catch (e) {
              console.warn('[SplashAuth] forgot pin auth error', e);
              Alert.alert('Unable to reset', 'Authentication failed. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.subtle}>Preparing…</Text>
      </View>
    );
  }

  const isValidPin = /^\d{4,6}$/.test(pin.trim());

  const title =
    mode === 'sign'
      ? 'Sign in'
      : mode === 'remove'
        ? 'Remove PIN'
        : mode === 'changeCurrent'
          ? 'Change PIN'
          : mode === 'changeNew'
            ? 'Choose new PIN'
            : 'Set PIN';

  const subtitle =
    mode === 'sign'
      ? 'Enter your PIN to continue'
      : mode === 'remove'
        ? 'Enter your current PIN to confirm removal'
        : mode === 'changeCurrent'
          ? 'Enter your current PIN first'
          : mode === 'changeNew'
            ? 'Enter and confirm your new PIN'
            : 'Create a PIN for quick access';

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.subtle}>{subtitle}</Text>

      {(mode === 'sign' || mode === 'remove' || mode === 'changeCurrent') && (
        <>
          <TextInput
            value={pin}
            onChangeText={(value) => {
              setPinInput(value);
              if (pinError) setPinError('');
            }}
            placeholder="PIN (4–6 digits)"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          {pinError ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{pinError}</Text>
            </View>
          ) : null}

          {biometricsUnavailableHint ? (
            <Text style={styles.hint}>{biometricsUnavailableHint}</Text>
          ) : null}

          {mode === 'sign' ? (
            <>
              <Pressable onPress={onForgotPin} hitSlop={10} style={styles.linkWrap}>
                <Text style={styles.linkText}>Forgot PIN?</Text>
              </Pressable>
              <Pressable
                style={[styles.primary, !isValidPin && { opacity: 0.5 }]}
                onPress={onSignIn}
                disabled={!isValidPin}
              >
                <Text style={styles.primaryText}>Sign In</Text>
              </Pressable>
            </>
          ) : null}

          {mode === 'changeCurrent' ? (
            <Pressable
              style={[styles.primary, !isValidPin && { opacity: 0.5 }]}
              onPress={onChangePinContinue}
              disabled={!isValidPin}
            >
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          ) : null}

          {mode === 'remove' ? (
            <Pressable
              style={[styles.primary, styles.danger, !isValidPin && { opacity: 0.5 }]}
              onPress={onRemovePinConfirm}
              disabled={!isValidPin}
            >
              <Text style={styles.primaryText}>Remove PIN</Text>
            </Pressable>
          ) : null}

          {(mode === 'changeCurrent' || mode === 'remove') && (
            <Pressable
              style={[styles.ghost, { marginTop: 10 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.ghostText}>Cancel</Text>
            </Pressable>
          )}
        </>
      )}

      {(mode === 'create' || mode === 'changeNew') && (
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
            onPress={onSaveNewPin}
            disabled={!isValidPin || confirm.trim().length === 0}
          >
            <Text style={styles.primaryText}>Save PIN</Text>
          </Pressable>

          {mode === 'changeNew' ? (
            <Pressable
              style={[styles.ghost, { marginTop: 10 }]}
              onPress={() => {
                setPinInput('');
                setConfirm('');
                setMode('changeCurrent');
              }}
            >
              <Text style={styles.ghostText}>Back</Text>
            </Pressable>
          ) : null}
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
  danger: {
    backgroundColor: '#7F1D1D',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  ghost: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  ghostText: {
    color: theme.textDim,
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
  linkWrap: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  linkText: {
    color: '#93C5FD',
    fontWeight: '700',
  },
});
