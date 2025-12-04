// src/screens/DataExportImportScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

const DataExportImportScreen: React.FC<Props> = () => {
  const { state } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const handleExportPress = () => {
    const totalAccounts = accounts.length;
    const totalTxs = txs.length;

    setLastStatus(
      `Export ready: ${totalAccounts} account(s) and ${totalTxs} transaction(s) will be included.`,
    );
  };

  const handleImportPress = () => {
    setLastStatus(
      'Import flow not wired yet. Paste or select a file in a future step.',
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Data export & import</Text>
      <Text style={styles.subtle}>
        Use this screen to take a backup of your data (export) or restore it
        from a file (import).
      </Text>

      {/* EXPORT CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Export data</Text>
        <Text style={styles.body}>
          This will prepare a snapshot of your current data so you can save or
          share it outside the app. For now, this is a simple placeholder – you
          can later plug in CSV/JSON file export.
        </Text>

        <Text style={styles.meta}>
          Currently loaded: {accounts.length} account(s), {txs.length}{' '}
          transaction(s).
        </Text>

        <Pressable style={styles.btnPrimary} onPress={handleExportPress}>
          <Text style={styles.btnPrimaryText}>Export data</Text>
        </Pressable>
      </View>

      {/* IMPORT CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Import data</Text>
        <Text style={styles.body}>
          In the future, this will allow you to restore from a backup file (for
          example, a JSON or CSV exported from this app).
        </Text>

        <Pressable style={styles.btnSecondary} onPress={handleImportPress}>
          <Text style={styles.btnSecondaryText}>
            Import from file (placeholder)
          </Text>
        </Pressable>
      </View>

      {lastStatus ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{lastStatus}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

export default DataExportImportScreen;

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: '#0B1018',
  },
  h1: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
    fontSize: 14,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2933',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 12,
  },
  meta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 12,
  },
  btnPrimary: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  btnSecondaryText: {
    color: '#E5E7EB',
    fontWeight: '500',
    fontSize: 14,
  },
  statusBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2933',
  },
  statusLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  statusText: {
    color: '#E5E7EB',
    fontSize: 13,
  },
});
