// src/screens/SettingsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import { colors as theme } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY_BIOMETRICS = '@debitlens/biometricsEnabled:v1';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { getPin, setPin, actions } = useApp();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);

  const pinTrimmed = (getPin() ?? '').trim();
  const hasPin = pinTrimmed.length > 0;

  const loadBiometricsPref = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_BIOMETRICS);
      setBiometricsEnabled(raw === 'true');
    } catch {
      setBiometricsEnabled(false);
    }
  }, []);

  useEffect(() => {
    void loadBiometricsPref();
  }, [loadBiometricsPref]);

  useEffect(() => {
    if (!hasPin) {
      setBiometricsAvailable(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const [hw, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (mounted) setBiometricsAvailable(!!hw && !!enrolled);
      } catch {
        if (mounted) setBiometricsAvailable(false);
      }
    })();
    return () => { mounted = false; };
  }, [hasPin]);

  const onBiometricsToggle = async (value: boolean) => {
    setBiometricsEnabled(value);
    try {
      if (value) {
        await AsyncStorage.setItem(STORAGE_KEY_BIOMETRICS, 'true');
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY_BIOMETRICS);
      }
    } catch (e) {
      console.warn('[settings] biometrics pref save failed', e);
      setBiometricsEnabled(!value);
    }
  };

  const onRemovePin = async () => {
    Alert.alert(
      'Remove PIN',
      'Are you sure you want to remove your PIN? You will no longer be required to sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove PIN',
          style: 'destructive',
          onPress: async () => {
            setPin(null);
            // Also disable biometrics when PIN is removed
            try {
              await AsyncStorage.removeItem(STORAGE_KEY_BIOMETRICS);
              setBiometricsEnabled(false);
            } catch (e) {
              console.warn('[settings] failed to clear biometrics on PIN removal', e);
            }
          },
        },
      ]
    );
  };

  const biometricsDisabled = !hasPin;
  const biometricsHelper =
    !hasPin
      ? 'Enable PIN to use Face ID / Biometrics'
      : biometricsAvailable === false
        ? 'Biometrics not available'
        : null;

  const onResetApp = () => {
    Alert.alert(
      'Reset DebitLens?',
      'This will permanently delete all accounts, transactions, recurring items, budgets, and your PIN from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await actions.resetApp();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Security & Access</Text>

          {/* PIN status */}
          <View style={styles.row}>
            <Text style={styles.label}>PIN</Text>
            <Text style={styles.value}>{hasPin ? 'On' : 'Off'}</Text>
          </View>

          {!hasPin ? (
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.btnText}>Set PIN</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.btnText}>Change PIN</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger, { marginTop: 8 }]}
                onPress={onRemovePin}
              >
                <Text style={styles.btnText}>Remove PIN</Text>
              </Pressable>
            </>
          )}

          {/* Biometrics toggle */}
          <View style={[styles.optionRow, { marginTop: 16 }]}>
            <Text style={styles.optionLabel}>Use Face ID / Biometrics</Text>
            <Switch
              value={biometricsEnabled}
              onValueChange={onBiometricsToggle}
              disabled={biometricsDisabled || biometricsAvailable === false}
            />
          </View>
          {biometricsHelper ? (
            <Text style={styles.helper}>{biometricsHelper}</Text>
          ) : null}
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger zone</Text>
          <Pressable style={styles.dangerButton} onPress={onResetApp}>
            <Text style={styles.dangerButtonText}>Reset app (delete all data)</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
  },
  wrap: { flex: 1 },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 24,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },

  card: {
    backgroundColor: theme.cardAlt,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: { color: theme.textDim, fontSize: 15 },
  value: { color: '#fff', fontWeight: '600' },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: '#2563EB' },
  btnGhost: { backgroundColor: theme.border },
  btnDanger: { backgroundColor: '#7F1D1D' },
  btnText: { color: '#fff', fontWeight: '700' },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: { color: '#E5E7EB', flex: 1, marginRight: 12 },
  helper: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 6,
  },

  dangerZone: {
    marginTop: 32,
  },
  dangerZoneTitle: {
    color: '#fff',
    fontWeight: '800',
    marginBottom: 8,
  },
  dangerButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  dangerButtonText: {
    color: '#ef4444',
    fontWeight: '800',
  },
});
