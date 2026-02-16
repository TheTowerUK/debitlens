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
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../state/AppContext';
import { colors as theme } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY_BIOMETRICS = '@debitlens/biometricsEnabled:v1';
const STORAGE_KEY_SESSION_TIMEOUT_MIN = '@debitlens/sessionTimeoutMinutes:v1';
const STORAGE_KEY_LAST_UNLOCKED_AT = '@debitlens/lastUnlockedAt:v1';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { getPin, setPin, actions } = useApp();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState<5 | 10 | 15>(5);
  const [lastUnlockedAt, setLastUnlockedAt] = useState<number | null>(null);

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

  const loadSessionTimeout = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_SESSION_TIMEOUT_MIN);
      const m = Number(raw);
      const safe = (m === 10 || m === 15 || m === 5) ? (m as 5 | 10 | 15) : 5;
      setTimeoutMinutes(safe);
    } catch {
      setTimeoutMinutes(5);
    }
  }, []);

  const loadLastUnlocked = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_LAST_UNLOCKED_AT);
      const v = Number(raw);
      setLastUnlockedAt(Number.isFinite(v) && v > 0 ? v : null);
    } catch {
      setLastUnlockedAt(null);
    }
  }, []);

  useEffect(() => {
    void loadBiometricsPref();
    void loadSessionTimeout();
    void loadLastUnlocked();
  }, [loadBiometricsPref, loadSessionTimeout, loadLastUnlocked]);

  useFocusEffect(
    useCallback(() => {
      void loadLastUnlocked();
    }, [loadLastUnlocked])
  );

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

  const setSessionTimeout = async (m: 5 | 10 | 15) => {
    setTimeoutMinutes(m);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SESSION_TIMEOUT_MIN, String(m));
    } catch (e) {
      console.warn('[settings] session timeout save failed', e);
      setTimeoutMinutes(5);
    }
  };

  const onLockNow = useCallback(() => {
    if (!hasPin) {
      return Alert.alert('PIN not set', 'Set a PIN first to enable locking.');
    }
    Alert.alert('Lock now', 'Return to the PIN screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lock',
        onPress: () => {
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  }, [navigation, hasPin]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log out', 'Return to the PIN screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  }, [navigation]);

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
            try {
              await AsyncStorage.removeItem('@debitlens/whereToStartSeen:v1');
            } catch {}
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
              disabled={biometricsDisabled || (!biometricsEnabled && biometricsAvailable === false)}
            />
          </View>
          {biometricsHelper ? (
            <Text style={styles.helper}>{biometricsHelper}</Text>
          ) : null}

          {/* Session timeout */}
          <View style={{ marginTop: 16 }}>
            <Text style={styles.optionLabel}>Auto-lock when returning after</Text>
            <View style={styles.segmentRow}>
              {[5, 10, 15].map((m) => {
                const selected = timeoutMinutes === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => void setSessionTimeout(m as 5 | 10 | 15)}
                    style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {m}m
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helper}>
              Applies when you leave the app and return. If biometrics is enabled, you may be asked to re-auth sooner.
            </Text>
          </View>

          {/* Last unlocked */}
          <View style={{ marginTop: 14 }}>
            <View style={styles.row}>
              <Text style={styles.label}>Last unlocked</Text>
              <Text style={styles.value}>
                {lastUnlockedAt
                  ? new Date(lastUnlockedAt).toLocaleString('en-GB')
                  : '—'}
              </Text>
            </View>
          </View>

          {/* Lock now */}
          <Pressable
            style={[styles.btn, styles.btnGhost, { marginTop: 10 }]}
            onPress={onLockNow}
          >
            <Text style={styles.btnText}>Lock now</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Help & Guide</Text>
          <Text style={styles.sectionText}>
            Not sure where to start? This guide explains the Dashboard, accounts, transactions, and recurring payments.
          </Text>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => navigation.navigate('Help')}
          >
            <Text style={styles.btnText}>Open guide</Text>
          </Pressable>
          <Text style={[styles.helper, { marginTop: 8 }]}>
            Takes about 1–2 minutes to read.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About DebitLens</Text>
          <Text style={styles.sectionText}>
            Philosophy, focus, and how we handle your data.
          </Text>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => navigation.navigate('About')}
          >
            <Text style={styles.btnText}>About</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Text style={styles.sectionText}>
            How DebitLens stores and handles data.
          </Text>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={styles.btnText}>Privacy Policy</Text>
          </Pressable>
        </View>

        {/* Security / Log out */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Security</Text>
          <Pressable
            onPress={handleLogout}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.negative,
              backgroundColor: theme.card,
            }}
          >
            <Text style={{ color: theme.negative, fontWeight: '800', fontSize: 16 }}>
              Log out
            </Text>
            <Text style={{ color: theme.textDim, marginTop: 4, fontSize: 12 }}>
              Return to the PIN screen.
            </Text>
          </Pressable>
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
    backgroundColor: theme.bg,
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
  sectionText: { color: theme.textDim, fontSize: 13, marginBottom: 10 },

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
  segmentRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    alignItems: 'center',
  },
  segmentBtnSelected: {
    borderColor: theme.link,
  },
  segmentText: {
    color: theme.textDim,
    fontWeight: '800',
  },
  segmentTextSelected: {
    color: theme.text,
  },
  helper: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 6,
  },

  dangerZone: {
    marginTop: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
