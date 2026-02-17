// src/screens/DataExportImportScreen.tsx
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

export default function DataExportImportScreen({ navigation }: Props) {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Data</Text>
      <Text style={styles.subtle}>
        Export your backup and transactions, or restore and import data.
      </Text>

      <View style={styles.card}>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('DataTransfer')}
        >
          <Text style={styles.btnPrimaryText}>Import & Export</Text>
        </Pressable>
        <Text style={styles.menuHint}>
          Export JSON backup and CSV, or import/restore data. Opens a single screen with Export and Import tabs.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 32 },

  h1: { color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtle: { color: theme.textDim, marginBottom: 16, marginTop: 6, lineHeight: 18 },

  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },

  btnPrimary: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnPrimaryText: { color: 'white', fontWeight: '600', textAlign: 'center', fontSize: 16 },

  menuHint: {
    color: theme.textDim,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
