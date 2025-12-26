// src/screens/SettingsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { resetDatabase } from '../dev/resetDb';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    } catch (e) {
      console.warn('[settings] reset DB failed', e);
      Alert.alert('Error', 'Could not reset the database.');
    }
  };

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>Settings</Text>
        <Text style={styles.subtle}>Minimal screen for isolation testing</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Data</Text>

          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={exportTemplate}
          >
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
            onPress={() => navigation.navigate('ImportCSV')}
          >
            <Text style={styles.btnText}>Import from CSV</Text>
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
  wrap: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 24,
  },
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subtle: { color: theme.textDim, marginBottom: 12 },

  card: {
    backgroundColor: theme.cardAlt,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },

  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: theme.border },
  btnDanger: { backgroundColor: '#7F1D1D' },
  btnText: { color: '#fff', fontWeight: '700' },
});
