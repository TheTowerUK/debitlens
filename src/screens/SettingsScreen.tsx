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
import * as LocalAuthentication from 'expo-local-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../state/AppContext';
import { useDataExportImport } from '../hooks/useDataExportImport';
import { colors as theme } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  loadSecuritySettings,
  saveSecuritySettings,
  type SessionTimeoutMinutes,
} from '../utils/settingsStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { getPin, actions } = useApp();
  const { endCsvImportSession, setLastStatus } = useDataExportImport();

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState<SessionTimeoutMinutes>(5);
  const [lastUnlockedAt, setLastUnlockedAt] = useState<number | null>(null);

  const pinTrimmed = (getPin() ?? '').trim();
  const hasPin = pinTrimmed.length > 0;

  const refreshSecurity = useCallback(async () => {
    try {
      const security = await loadSecuritySettings();
      setBiometricsEnabled(security.biometricsEnabled);
      setTimeoutMinutes(security.sessionTimeoutMinutes);
      setLastUnlockedAt(security.lastUnlockedAt);
    } catch {
      setBiometricsEnabled(false);
      setTimeoutMinutes(5);
      setLastUnlockedAt(null);
    }
  }, []);

  useEffect(() => {
    void refreshSecurity();
  }, [refreshSecurity]);

  useFocusEffect(
    useCallback(() => {
      void refreshSecurity();
    }, [refreshSecurity])
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
    return () => {
      mounted = false;
    };
  }, [hasPin]);

  const onBiometricsToggle = async (value: boolean) => {
    if (!hasPin) {
      Alert.alert('PIN required', 'Set a PIN before enabling biometrics.');
      return;
    }

    if (!value) {
      setBiometricsEnabled(false);
      try {
        await saveSecuritySettings({ biometricsEnabled: false });
      } catch {
        setBiometricsEnabled(true);
      }
      return;
    }

    if (biometricsAvailable === false) {
      Alert.alert('Unavailable', 'Biometrics is not available on this device.');
      return;
    }

    try {
      const [hw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hw || !enrolled) {
        Alert.alert('Unavailable', 'Enroll Face ID / fingerprint in device settings first.');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric unlock',
        fallbackLabel: 'Cancel',
      });

      if (!result.success) return;

      setBiometricsEnabled(true);
      await saveSecuritySettings({ biometricsEnabled: true });
    } catch (e) {
      console.warn('[settings] biometrics enable failed', e);
      setBiometricsEnabled(false);
    }
  };

  const setSessionTimeout = async (m: SessionTimeoutMinutes) => {
    setTimeoutMinutes(m);
    try {
      await saveSecuritySettings({ sessionTimeoutMinutes: m });
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
          navigation.reset({ index: 0, routes: [{ name: 'Login', params: { flow: 'sign' } }] });
        },
      },
    ]);
  }, [navigation, hasPin]);

  const handleLogout = useCallback(() => {
    Alert.alert('Lock app', 'Return to the PIN screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lock',
        style: 'destructive',
        onPress: () => {
          navigation.reset({ index: 0, routes: [{ name: 'Login', params: { flow: 'sign' } }] });
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
            await endCsvImportSession();
            setLastStatus('App reset complete.');
            try {
              await AsyncStorage.removeItem('@debitlens/whereToStartSeen:v1');
            } catch {
              // ignore
            }
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  const biometricsDisabled = !hasPin;
  const biometricsHelper = !hasPin
    ? 'Set a PIN first to enable biometrics.'
    : biometricsAvailable === false
      ? 'Biometrics not available on this device.'
      : null;

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.pageTitle}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>PIN</Text>
          <Text style={styles.sectionHint}>
            PIN is required for app security. Biometrics and auto-lock depend on it.
          </Text>

          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{hasPin ? 'On' : 'Off'}</Text>
          </View>

          {!hasPin ? (
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => navigation.navigate('Login', { flow: 'create' })}
            >
              <Text style={styles.btnText}>Set PIN</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => navigation.navigate('Login', { flow: 'change' })}
              >
                <Text style={styles.btnText}>Change PIN</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDanger, { marginTop: 8 }]}
                onPress={() => navigation.navigate('Login', { flow: 'remove' })}
              >
                <Text style={styles.btnText}>Remove PIN</Text>
              </Pressable>
              <Text style={styles.helper}>
                Remove PIN also turns off biometric unlock.
              </Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Biometrics</Text>
          <Text style={styles.sectionHint}>
            Use Face ID or fingerprint after the auto-lock timeout. Falls back to PIN if cancelled.
          </Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Enable biometric unlock</Text>
            <Switch
              value={biometricsEnabled}
              onValueChange={onBiometricsToggle}
              disabled={biometricsDisabled || (!biometricsEnabled && biometricsAvailable === false)}
            />
          </View>
          {biometricsHelper ? <Text style={styles.helper}>{biometricsHelper}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Auto-lock</Text>
          <Text style={styles.sectionHint}>
            When the app goes to the background, we save the time. Returning after this period requires unlock.
          </Text>

          <Text style={styles.optionLabel}>Require unlock after</Text>
          <View style={styles.segmentRow}>
            {([5, 10, 15] as const).map((m) => {
              const selected = timeoutMinutes === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => void setSessionTimeout(m)}
                  style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                >
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                    {m} min
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.row, { marginTop: 14 }]}>
            <Text style={styles.label}>Last unlocked</Text>
            <Text style={styles.value}>
              {lastUnlockedAt ? new Date(lastUnlockedAt).toLocaleString('en-GB') : '—'}
            </Text>
          </View>

          <Pressable style={[styles.btn, styles.btnGhost, { marginTop: 10 }]} onPress={onLockNow}>
            <Text style={styles.btnText}>Lock now</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.sectionHint}>
            Daily and weekly local summaries. Settings are saved on this device.
          </Text>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.btnText}>Notification settings</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>About DebitLens</Text>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => navigation.navigate('About')}
          >
            <Text style={styles.btnText}>About</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Policy</Text>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Text style={styles.btnText}>Privacy Policy</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Session</Text>
          <Pressable onPress={handleLogout} style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>Lock app</Text>
            <Text style={styles.lockBtnHint}>Return to the PIN screen without removing your PIN.</Text>
          </Pressable>
        </View>

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
  safeWrap: { flex: 1, backgroundColor: theme.bg },
  wrap: { flex: 1 },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 24,
  },
  pageTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  card: {
    backgroundColor: theme.cardAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 6, fontSize: 16 },
  sectionHint: { color: theme.textDim, fontSize: 12, marginBottom: 12, lineHeight: 17 },
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
  optionLabel: { color: '#E5E7EB', flex: 1, marginRight: 12, fontWeight: '600' },
  segmentRow: { flexDirection: 'row', columnGap: 8, marginTop: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    alignItems: 'center',
  },
  segmentBtnSelected: { borderColor: theme.link },
  segmentText: { color: theme.textDim, fontWeight: '800' },
  segmentTextSelected: { color: theme.text },
  helper: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  lockBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  lockBtnText: { color: '#E5E7EB', fontWeight: '800', fontSize: 16 },
  lockBtnHint: { color: theme.textDim, marginTop: 4, fontSize: 12 },
  dangerZone: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  dangerZoneTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  dangerButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  dangerButtonText: { color: '#ef4444', fontWeight: '800' },
});
