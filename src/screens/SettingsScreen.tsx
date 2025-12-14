// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { resetDatabase } from '../dev/resetDb';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

const CSV_TEMPLATE = `date,amount,type,account,category,note
2025-10-01,12.50,expense,Main,Groceries,Milk & bread
2025-10-03,2500,income,Main,Salary,October
`;

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

// Cast to any so we can use cacheDirectory / EncodingType without fighting TS
const FS = FileSystem as any;

export default function SettingsScreen({ navigation }: Props) {
  const exportTemplate = async () => {
    try {
      const base = FS.cacheDirectory ?? '';
      const path = `${base}debitlens_template.csv`;
      const encoding = FS.EncodingType?.UTF8 ?? 'utf8';

      if (typeof FS.writeAsStringAsync === 'function') {
        await FS.writeAsStringAsync(path, CSV_TEMPLATE, { encoding });
      } else {
        // fallback if options signature isn’t available
        await FS.writeAsStringAsync(path, CSV_TEMPLATE);
      }

      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'CSV template',
      });
    } catch (e) {
      console.warn('[settings] template export failed', e);
      Alert.alert('Error', 'Could not export the template.');
    }
  };

  const onResetDb = async () => {
    try {
      await resetDatabase();
      Alert.alert('Database reset', 'The local database file was deleted.');
      // After a reset, you typically restart the app or re-run migrations on next launch.
    } catch (e) {
      console.warn('[settings] reset DB failed', e);
      Alert.alert('Error', 'Could not reset the database.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.subtle}>Minimal screen for isolation testing</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Data</Text>

        <Pressable style={[styles.btn, styles.btnGhost]} onPress={exportTemplate}>
          <Text style={styles.btnText}>Export CSV template</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnDanger, { marginTop: 8 }]}
          onPress={onResetDb}
        >
          <Text style={styles.btnText}>Reset local database</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
          onPress={() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }}
        >
          <Text style={styles.btnText}>Sign out</Text>
        </Pressable>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtle: { color: '#9CA3AF' },

  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, marginTop: 12 },

  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: '#1F2937' },
  btnDanger: { backgroundColor: '#7F1D1D' },
  btnText: { color: '#fff', fontWeight: '700' },
});
