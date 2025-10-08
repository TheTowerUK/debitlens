// src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useApp } from '../state/AppState';

export default function LoginScreen({ navigation }) {
  const { actions, clearPin } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      if (!name.trim()) return Alert.alert('Name required', 'Please enter your name.');
      setLoading(true);
      await actions.signIn({ name: name.trim(), email: email.trim(), remember });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e) {
      console.warn('login error', e);
      Alert.alert('Login failed', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onGuest = async () => {
    try {
      setLoading(true);
      await actions.signIn({ name: 'Guest', email: '', remember: false });
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e) {
      Alert.alert('Could not continue as guest');
    } finally {
      setLoading(false);
    }
  };

  const onResetPin = async () => {
    await clearPin(); // removes stored PIN so SplashAuth won’t prompt for it next time
    Alert.alert('PIN cleared', 'Your PIN has been cleared. You can set a new one next time on the splash screen.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.h1}>Welcome back</Text>
        <Text style={styles.subtle}>Sign in to continue</Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor="#6B7280"
          style={styles.input}
          autoCapitalize="words"
        />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email (optional)"
          placeholderTextColor="#6B7280"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Remember me</Text>
          <Switch value={remember} onValueChange={setRemember} />
        </View>

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={onLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={onGuest}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>Continue as Guest</Text>
        </Pressable>

        <Pressable onPress={onResetPin} style={styles.linkBtn}>
          <Text style={styles.linkText}>Reset PIN</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0B0D13', padding: 24, justifyContent: 'center' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 20 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtle: { color: '#9CA3AF', marginBottom: 16 },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { color: '#E5E7EB', fontSize: 14 },

  primary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700' },

  secondary: { backgroundColor: '#374151', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: '#fff', fontWeight: '700' },

  linkBtn: { alignItems: 'center', marginTop: 14 },
  linkText: { color: '#93C5FD', fontWeight: '600' },

  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
