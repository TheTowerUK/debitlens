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
import * as DocumentPicker from 'expo-document-picker';

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

// Look up account name from any accounts array (current or imported)
function getAccountNameFromAccounts(
  accountId: unknown,
  sourceAccounts: any[],
): string {
  if (!accountId) return '';
  const acc = sourceAccounts.find((a) => a.id === accountId);
  return acc?.name ?? '';
}

// Look up existing app account by name
function findExistingAccountIdByName(
  name: string | null | undefined,
  accounts: any[],
): string | null {
  if (!name) return null;
  const acc = accounts.find(
    (a) => typeof a.name === 'string' && a.name.trim() === name.trim(),
  );
  return acc?.id ?? null;
}

// Very simple CSV parser that supports quoted values and commas
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }

    result.push(current);
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => parseLine(l));

  return { headers, rows };
}

// Compute transaction type from a row/tx + amount fallback
function resolveType(rawType: unknown, rawAmount: unknown): 'income' | 'expense' {
  const t = (rawType ?? '').toString().toLowerCase();
  if (t === 'income' || t === 'expense') return t;

  const n = Number(rawAmount);
  if (Number.isFinite(n)) {
    return n >= 0 ? 'income' : 'expense';
  }
  // Default fallback
  return 'expense';
}

// Build a transaction object for addTransaction(), best-effort mapping
function buildTransactionFromData(
  row: Record<string, any>,
  accountId: string,
): any {
  // Date
  const rawDate =
    row.date ??
    row.txnDate ??
    row.transactionDate ??
    row.createdAt ??
    row.updatedAt ??
    new Date().toISOString();
  const date = formatMaybeDate(rawDate, 'date');

  // Amount
  const rawAmount = row.amount ?? row.value ?? row.total ?? 0;
  const amountNum = Number(rawAmount);
  const amount = Number.isFinite(amountNum) ? amountNum : 0;

  // Type (use explicit value if present, otherwise infer from amount)
  const type = resolveType(row.type, amount);

  // Description / notes
  const description =
    row.description ??
    row.notes ??
    row.memo ??
    row.category ??
    'Imported transaction';

  // Category
  const category =
    row.category ??
    row.cat ??
    (amount < 0 ? 'Expense' : 'Income');

  return {
    accountId,
    date,
    amount,
    type,
    description,
    category,
  };
}

const DataExportImportScreen: React.FC<Props> = () => {
  const { state, actions } = useApp();

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
      // - force a "type" column
      const rawHeaders: string[] = Object.keys(txsForCsv[0]);

      const excluded = ['id', 'accountId'];

      const hasDate = rawHeaders.includes('date');
      const hasType = rawHeaders.includes('type');

      const otherHeaders = rawHeaders.filter(
        (h) =>
          !excluded.includes(h) &&
          h !== 'date' &&
          h.toLowerCase() !== 'account' &&
          h !== 'type',
      );

      const headers: string[] = [];
      if (hasDate) headers.push('date');
      headers.push('account'); // human-readable account name
      headers.push('type'); // ensure type column is always present
      headers.push(...otherHeaders);

      const headerLine = headers.map((h) => escapeCsv(h)).join(',');

      const rows = txsForCsv.map((tx) =>
        headers
          .map((h) => {
            if (h === 'account') {
              // Current app accounts: tx.accountId is already using these
              const accId = tx.accountId;
              const name = accId
                ? getAccountNameFromAccounts(accId, accounts)
                : '';
              return escapeCsv(name);
            }

            if (h === 'type') {
              const type = resolveType(tx.type, tx.amount);
              return escapeCsv(type);
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

  const handleImportJsonMerge = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLastStatus('JSON import cancelled before file selection.');
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        setLastStatus('JSON import failed: No file selected or invalid file.');
        return;
      }

      const fileUri = asset.uri;

      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'utf8',
      });

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr: any) {
        console.error('Import parse error', parseErr);
        setLastStatus(
          'JSON import failed: Selected file is not valid JSON or is corrupted.',
        );
        return;
      }

      const importedAccounts = Array.isArray(parsed.accounts)
        ? parsed.accounts
        : [];
      const importedTxs = Array.isArray(parsed.transactions)
        ? parsed.transactions
        : [];

      if (!importedAccounts.length && !importedTxs.length) {
        setLastStatus(
          'JSON import file parsed, but no accounts or transactions were found.',
        );
        return;
      }

      let added = 0;
      let skippedNoAccount = 0;

      for (const tx of importedTxs) {
        // Find account name in imported data
        const accountNameFromImported =
          getAccountNameFromAccounts(tx.accountId, importedAccounts) ||
          tx.account ||
          tx.accountName ||
          '';

        const targetAccountId = findExistingAccountIdByName(
          accountNameFromImported,
          accounts,
        );

        if (!targetAccountId) {
          skippedNoAccount++;
          continue;
        }

        const txForAdd = buildTransactionFromData(tx, targetAccountId);

        try {
          actions.addTransaction(txForAdd);
          added++;
        } catch (e) {
          console.warn('Failed to add imported JSON transaction', e);
        }
      }

      setLastStatus(
        `JSON import complete: ${added} transaction(s) merged into existing accounts. ` +
          (skippedNoAccount
            ? `${skippedNoAccount} transaction(s) skipped because the account name was not found in current data.`
            : ''),
      );
    } catch (err: any) {
      console.error('JSON import error', err);
      setLastStatus(
        `JSON import failed: ${err?.message ?? 'Unknown error occurred while reading the file.'}`,
      );
    }
  };

  const handleImportCsvMerge = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLastStatus('CSV import cancelled before file selection.');
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        setLastStatus('CSV import failed: No file selected or invalid file.');
        return;
      }

      const fileUri = asset.uri;

      const content = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'utf8',
      });

      const { headers, rows } = parseCsv(content);
      if (!headers.length || !rows.length) {
        setLastStatus('CSV import failed: File is empty or has no rows.');
        return;
      }

      // Find key columns
      const idxOf = (name: string): number =>
        headers.findIndex(
          (h) => h.toLowerCase() === name.toLowerCase(),
        );

      const dateIdx = idxOf('date');
      const accountIdx = idxOf('account');
      const amountIdx =
        idxOf('amount') >= 0 ? idxOf('amount') : idxOf('value');
      const typeIdx = idxOf('type');
      const descIdx =
        idxOf('description') >= 0
          ? idxOf('description')
          : idxOf('notes');
      const categoryIdx = idxOf('category');

      if (accountIdx < 0) {
        setLastStatus(
          'CSV import failed: Could not find an "account" column in the header row.',
        );
        return;
      }

      let added = 0;
      let skippedNoAccount = 0;

      for (const row of rows) {
        const get = (idx: number): string =>
          idx >= 0 && idx < row.length ? row[idx] : '';

        const accountName = get(accountIdx);
        const targetAccountId = findExistingAccountIdByName(
          accountName,
          accounts,
        );
        if (!targetAccountId) {
          skippedNoAccount++;
          continue;
        }

        const rawObj: Record<string, any> = {
          date: dateIdx >= 0 ? get(dateIdx) : undefined,
          account: accountName,
          amount: amountIdx >= 0 ? get(amountIdx) : undefined,
          type: typeIdx >= 0 ? get(typeIdx) : undefined,
          description: descIdx >= 0 ? get(descIdx) : undefined,
          category: categoryIdx >= 0 ? get(categoryIdx) : undefined,
        };

        const txForAdd = buildTransactionFromData(rawObj, targetAccountId);

        try {
          actions.addTransaction(txForAdd);
          added++;
        } catch (e) {
          console.warn('Failed to add imported CSV transaction', e);
        }
      }

      setLastStatus(
        `CSV import complete: ${added} transaction(s) merged into existing accounts. ` +
          (skippedNoAccount
            ? `${skippedNoAccount} row(s) skipped because the account name did not match any existing account.`
            : ''),
      );
    } catch (err: any) {
      console.error('CSV import error', err);
      setLastStatus(
        `CSV import failed: ${err?.message ?? 'Unknown error occurred while reading the file.'}`,
      );
    }
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
          You can merge data from a JSON backup (exported by DebitLens) or from
          a CSV file. Imported transactions are added to your existing accounts,
          and rows with unknown account names are skipped.
        </Text>

        <Pressable style={styles.btnSecondary} onPress={handleImportJsonMerge}>
          <Text style={styles.btnSecondaryText}>
            Import from JSON backup (merge)
          </Text>
        </Pressable>

        <Pressable style={styles.btnSecondary} onPress={handleImportCsvMerge}>
          <Text style={styles.btnSecondaryText}>
            Import from CSV (merge transactions)
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
