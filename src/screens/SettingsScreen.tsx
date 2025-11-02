// src/screens/SettingsScreen.js (minimal, safe)
import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';   // ✅ non-legacy
import * as Sharing from 'expo-sharing';
import { resetDatabase } from '../dev/resetDb';   // no await at top!
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

const CSV_TEMPLATE = `date,amount,type,account,category,note
2025-10-01,12.50,expense,Main,Groceries,Milk & bread
2025-10-03,2500,income,Main,Salary,October
`;
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }) {
  const exportTemplate = async () => {
    try {
  const base = (FileSystem as any).cacheDirectory ?? '';
  const path = `${base}debitlens_template.csv`;
  const encoding = (FileSystem as any).EncodingType?.UTF8 ?? 'utf8';
  if (typeof (FileSystem as any).writeAsStringAsync === 'function') {
    await (FileSystem as any).writeAsStringAsync(path, CSV_TEMPLATE, { encoding });
  } else {
    await (FileSystem as any).writeAsStringAsync(path, CSV_TEMPLATE);
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
      await resetDatabase(); // ✅ run on button press, not at top level
      Alert.alert('Database reset', 'The local database file was deleted.');
      // After a reset, either restart the app or re-run migrations on next launch.
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

        <Pressable style={[styles.btn, styles.btnDanger, { marginTop: 8 }]} onPress={onResetDb}>
          <Text style={styles.btnText}>Reset local database</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
          onPress={() => navigation.navigate('ImportCSV')}
        >
          <Text style={styles.btnText}>Import from CSV</Text>
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
