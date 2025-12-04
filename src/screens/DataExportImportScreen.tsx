// src/screens/DataExportImportScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

// Simple CSV escaping: wraps in quotes if needed, doubles any existing quotes
function escapeCsv(value: string): string {
  const needsQuotes =
    value.includes(',') || value.includes('"') || value.includes('\n');

  let v = value.replace(/"/g, '""');
  return needsQuotes ? `"${v}"` : v;
}

const DataExportImportScreen: React.FC<Props> = () => {
  const { state } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const handleExportJsonPress = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts,
        transactions: txs,
      };

      const json = JSON.stringify(payload, null, 2);

      const result = await Share.share({
        title: 'Base44 data export (JSON)',
        message: json,
      });

      if (result.action === Share.sharedAction) {
        setLastStatus(
          `JSON export shared. ${accounts.length} account(s) and ${txs.length} transaction(s) included.`,
        );
      } else if (result.action === Share.dismissedAction) {
        setLastStatus('JSON export cancelled before sharing.');
      } else {
        setLastStatus('JSON export finished with unknown status.');
      }
    } catch (err: any) {
      console.error('JSON export error', err);
      setLastStatus(
        `JSON export failed: ${err?.message ?? 'Unknown error occurred.'}`,
      );
    }
  };

  const handleExportCsvPress = async () => {
    try {
      const txsForCsv = txs as any[];

      if (!txsForCsv.length) {
        setLastStatus('No transactions available to export as CSV.');
        return;
      }

      // Use the keys from the first transaction as the CSV header
      const headers: string[] = Object.keys(txsForCsv[0]);

      const headerLine = headers.map((h) => escapeCsv(h)).join(',');

      const rows = txsForCsv.map((tx) =>
        headers
          .map((h) => {
            const v = tx[h];
            return escapeCsv(
              v === null || v === undefined ? '' : String(v),
            );
          })
          .join(','),
      );

      const csv = [headerLine, ...rows].join('\n');

      const result = await Share.share({
        title: 'Base44 transactions export (CSV)',
        message: csv,
      });

      if (result.action === Share.sharedAction) {
        setLastStatus(
          `CSV export shared. ${txs.length} transaction(s) included.`,
        );
      } else if (result.action === Share.dismissedAction) {
        setLastStatus('CSV export cancelled before sharing.');
      } else {
        setLastStatus('CSV export finished with unknown status.');
      }
    } catch (err: any) {
      console.error('CSV export error', err);
      setLastStatus(
        `CSV export failed: ${err?.message ?? 'Unknown error occurred.'}`,
      );
    }
  };

  const handleImportPress = () => {
    setLastStatus(
      'Import flow not wired yet. In future, you will paste or select a JSON/CSV export file here.',
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
          You can export all data as JSON (full backup) or export just
          transactions as CSV for spreadsheets.
        </Text>

        <Text style={styles.meta}>
          Currently loaded: {accounts.length} account(s), {txs.length}{' '}
          transaction(s).
        </Text>

        {/* JSON export */}
        <Pressable style={styles.btnPrimary} onPress={handleExportJsonPress}>
          <Text style={styles.btnPrimaryText}>Export as JSON (full backup)</Text>
        </Pressable>

        {/* CSV export */}
        <Pressable style={styles.btnSecondary} onPress={handleExportCsvPress}>
          <Text style={styles.btnSecondaryText}>
            Export transactions as CSV
          </Text>
        </Pressable>
      </View>

      {/* IMPORT CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Import data</Text>
        <Text style={styles.body}>
          In the future, this will allow you to restore from a backup JSON or
          CSV created by the Export functions above.
        </Text>

        <Pressable style={styles.btnSecondary} onPress={handleImportPress}>
          <Text style={styles.btnSecondaryText}>
            Import from backup (placeholder)
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
    marginBottom: 10,
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
    marginTop: 4,
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
