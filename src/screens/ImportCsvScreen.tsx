// src/screens/ImportCsvScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportCSV'>;

export default function ImportCsvScreen({ navigation }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Import from CSV</Text>
      <Text style={styles.subtle}>
        CSV import placeholder. We can wire file selection and parsing here later.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How this will work</Text>
        <Text style={styles.body}>
          • You&apos;ll pick a CSV file exported from your bank.
        </Text>
        <Text style={styles.body}>
          • The app will map columns (date, amount, description, etc.).
        </Text>
        <Text style={styles.body}>
          • Then transactions will be imported into your local database.
        </Text>
      </View>

      <Pressable
        style={[styles.btn, styles.btnGhost, { marginTop: 16 }]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.btnText}>Back</Text>
      </Pressable>
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
  h1: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtle: { color: '#9CA3AF', marginBottom: 16 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  sectionTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  body: { color: '#E5E7EB', marginTop: 4 },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: '#1F2937' },
  btnText: { color: '#fff', fontWeight: '700' },
});
