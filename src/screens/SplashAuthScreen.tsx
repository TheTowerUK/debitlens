// src/screens/SplashAuthScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';

// Route key in RootStackParamList should be 'Login'
type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function SplashAuthScreen({ navigation }: Props) {
  const { getPin, setPin } = useApp();

  // Use simple string modes: 'loading' | 'sign' | 'pin'
  const [mode, setMode] = useState<string>('loading');
  const [pin, setPinInput] = useState('');
  const [confirm, setConfirm] = useState('');

  // Decide whether to show "Sign in" or "Create PIN"
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await getPin();
        if (!mounted) return;
        setMode(stored ? 'sign' : 'pin');
      } catch {
        if (!mounted) return;
        setMode('sign');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [getPin]);

  const onSignIn = async () => {
    try {
      const stored = await getPin();
      const entered = pin.trim();

      if (stored && stored.trim() === entered) {
        navigation.replace('Dashboard');
      } else {
        Alert.alert('Incorrect PIN', 'Please try again.');
        setPinInput('');
      }
    } catch {
      Alert.alert('Error', 'Unable to verify PIN right now.');
    }
  };

  const onSavePin = async () => {
    const p1 = pin.trim();
    const p2 = confirm.trim();

    if (!/^\d{4,6}$/.test(p1)) {
      return Alert.alert('Invalid PIN', 'Enter 4–6 digits.');
    }
    if (p1 !== p2) {
      return Alert.alert('Mismatch', 'PINs do not match.');
    }

    try {
      await setPin(p1);
      navigation.replace('Dashboard');
    } catch {
      Alert.alert('Error', 'Unable to save PIN right now.');
    }
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
            onChangeText={setPinInput}
            placeholder="PIN (4–6 digits)"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          <Pressable
            style={styles.primary}
            onPress={onSignIn}
            disabled={!isValidPin}
          >
            <Text style={styles.primaryText}>Sign In</Text>
          </Pressable>

          <Pressable
            style={[styles.ghost, { marginTop: 8 }]}
            onPress={() => {
              setPinInput('');
              setMode('pin');
            }}
          >
            <Text style={styles.ghostText}>Set / Change PIN</Text>
          </Pressable>

          <Pressable
            style={[styles.ghost, { marginTop: 8 }]}
            onPress={() => navigation.replace('Dashboard')}
          >
            <Text style={styles.ghostText}>Continue without PIN</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={pin}
            onChangeText={setPinInput}
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
            style={styles.primary}
            onPress={onSavePin}
            disabled={!isValidPin || confirm.trim().length === 0}
          >
            <Text style={styles.primaryText}>Save PIN</Text>
          </Pressable>

          <Pressable
            style={[styles.ghost, { marginTop: 8 }]}
            onPress={() => {
              setPinInput('');
              setConfirm('');
              setMode('sign');
            }}
          >
            <Text style={styles.ghostText}>Back to Sign In</Text>
          </Pressable>

          <Pressable
            style={[styles.ghost, { marginTop: 8 }]}
            onPress={() => navigation.replace('Dashboard')}
          >
            <Text style={styles.ghostText}>Continue without PIN</Text>
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
    color: '#9CA3AF',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
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
  ghost: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
});
