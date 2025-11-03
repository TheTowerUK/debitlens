// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mode, setMode] = useState<'signin' | 'setpin'>('signin');

  const onSignIn = () => {
    // For now, just accept any PIN and go to Dashboard
    if (!pin.trim()) {
      Alert.alert('Enter a PIN', 'For now this can be anything.');
      return;
    }
    navigation.replace('Dashboard');
  };

  const onSavePin = () => {
    // Stubbed: just check they match and go to Dashboard
    const p1 = pin.trim();
    const p2 = confirm.trim();
    if (!p1 || !p2) {
      Alert.alert('Enter and confirm PIN');
      return;
    }
    if (p1 !== p2) {
      Alert.alert('Mismatch', 'PINs do not match.');
      return;
    }
    navigation.replace('Dashboard');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Welcome</Text>
      <Text style={styles.subtle}>
        {mode === 'signin'
          ? 'Enter your PIN to continue'
          : 'Create a PIN for quick access'}
      </Text>

      {mode === 'signin' ? (
        <>
          <TextInput
            value={pin}
            onChangeText={setPin}
            placeholder="PIN (any value)"
            placeholderTextColor="#6B7280"
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
          />

          <Pressable style={styles.primary} onPress={onSignIn}>
            <Text style={styles.primaryText}>Sign In</Text>
          </Pressable>

          <Pressable
            style={[styles.ghost, { marginTop: 8 }]}
            onPress={() => {
              setPin('');
              setMode('setpin');
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
            onChangeText={setPin}
            placeholder="New PIN"
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

          <Pressable style={styles.primary} onPress={onSavePin}>
            <Text style={styles.primaryText}>Save PIN</Text>
          </Pressable>

          <Pressable
            style={[styles.ghost, { marginTop: 8 }]}
            onPress={() => {
              setPin('');
              setConfirm('');
              setMode('signin');
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
  h1: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtle: { color: '#9CA3AF', marginBottom: 16 },
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
  primaryText: { color: '#fff', fontWeight: '700' },
  ghost: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostText: { color: '#E5E7EB', fontWeight: '700' },
});
