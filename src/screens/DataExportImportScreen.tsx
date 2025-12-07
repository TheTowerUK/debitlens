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

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

// Simple CSV escaping: wraps in quotes if needed, doubles any existing quotes
function escapeCsv(value: string): string {
  const needsQuotes =
    value.includes(',') || value.includes('"') || value.includes('\n');

  let v = value.replace(/"/g, '""');
  return needsQuotes ? `"${v}"` : v;
}

// Format date-like strings to YYYY-MM-DD
function formatMaybeDate(value: unknown, fieldName: string): string {
  if (value == null) return '';

  if (typeof value !== 'string') return String(value);

  const lowerField = fieldName.toLowerCase();

  // ISO-like date: "YYYY-MM-DDT..."
  const looksIso = /^\d{4}-\d{2}-\d{2}T/.test(value);

  if (looksIso || lowerField.includes('date')) {
    if (value.length >= 10) {
      return value.slice(0, 10);
    }
  }

  return value;
}

// Look up account name from accountId
function getAccountName(accountId: unknown, accounts: any[]): string {
  if (!accountId) return '';
  const acc = accounts.find((a) => a.id === accountId);
  return acc?.name ?? '';
}

const DataExportImportScreen: React.FC<Props> = () => {
  const { state } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [lastStatus, setLastStatus] = useState<string | null>(null);

  // Expo provides documentDirectory; fall back to '' just in case.
  const exportDir = (FileSystem.documentDirectory ?? '') as string;

  const handleExportJsonPress = async () => {
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts,
        transactions: txs,
      };

      const json = JSON.stringify(payload, null, 2);

      const filename = `debitlens-export-${Date.now()}.json`;
      const fileUri = exportDir + filename;

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: 'utf8',
      });

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share DebitLens JSON export',
        });
        setLastStatus(
          `JSON export created as file (${filename}) and sharing dialog shown.`,
        );
      } else {
        setLastStatus(
          `JSON export file created at: ${fileUri} — but file sharing is not available on this device.`,
        );
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

      // Use keys from the first transaction, but we:
      // - exclude internal IDs
      // - replace accountId with a friendly "account" column
      const rawHeaders: string[] = Object.keys(txsForCsv[0]);

      const excluded = ['id', 'accountId'];

      const hasDate = rawHeaders.includes('date');
      const otherHeaders = rawHeaders.filter(
        (h) => !excluded.includes(h) && h !== 'date',
      );

      const headers: string[] = [];
      if (hasDate) headers.push('date');
      headers.push('account'); // human-readable account name
      headers.push(...otherHeaders);

      const headerLine = headers.map((h) => escapeCsv(h)).join(',');

      const rows = txsForCsv.map((tx) =>
        headers
          .map((h) => {
            if (h === 'account') {
              const name = getAccountName(tx.accountId, accounts);
              return escapeCsv(name);
            }

            const formatted = formatMaybeDate(tx[h], h);
            return escapeCsv(formatted);
          })
          .join(','),
      );

      const csv = [headerLine, ...rows].join('\n');

      const filename = `debitlens-transactions-${Date.now()}.csv`;
      const fileUri = exportDir + filename;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: 'utf8',
      });

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Share DebitLens CSV export',
        });
        setLastStatus(
          `CSV export created as file (${filename}) and sharing dialog shown.`,
        );
      } else {
        setLastStatus(
          `CSV export file created at: ${fileUri} — but file sharing is not available on this device.`,
        );
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
      'Import flow not wired yet. Later you will be able to import from a JSON/CSV file created by the export options.',
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
          Export a full JSON backup or a CSV of your transactions as actual
          files you can save or send elsewhere.
        </Text>

        <Text style={styles.meta}>
          Currently loaded: {accounts.length} account(s), {txs.length}{' '}
          transaction(s).
        </Text>

        {/* JSON export */}
        <Pressable style={styles.btnPrimary} onPress={handleExportJsonPress}>
          <Text style={styles.btnPrimaryText}>Export as JSON (file)</Text>
        </Pressable>

        {/* CSV export */}
        <Pressable style={styles.btnSecondary} onPress={handleExportCsvPress}>
          <Text style={styles.btnSecondaryText}>
            Export transactions as CSV (file)
          </Text>
        </Pressable>
      </View>

      {/* IMPORT CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Import data</Text>
        <Text style={styles.body}>
          In the future, this will allow you to restore from a JSON or CSV file
          generated by the export options above.
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
