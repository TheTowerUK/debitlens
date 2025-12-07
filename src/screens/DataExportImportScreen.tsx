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

// ---------- Helpers ----------

// Simple CSV escaping: wraps in quotes if needed, doubles any existing quotes
function escapeCsv(value: string): string {
  const needsQuotes =
    value.includes(',') || value.includes('"') || value.includes('\n');

  let v = value.replace(/"/g, '""');
  return needsQuotes ? `"${v}"` : v;
}

// Parse mixed numeric strings like "£1,234.56", "$-45.67", "(123.45)"
function parseMixedNumber(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }

  let s = String(raw).trim();
  if (!s) return 0;

  // Handle parentheses as negatives: (123.45) -> -123.45
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }

  // Remove currency symbols and stray spaces
  s = s.replace(/[^0-9.,\-+]/g, '');

  // Remove thousands separators (commas)
  // We assume last dot or comma is decimal separator; remove all others.
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  const decimalPos = Math.max(lastDot, lastComma);

  if (decimalPos !== -1) {
    const intPart = s.slice(0, decimalPos).replace(/[.,]/g, '');
    const decPart = s.slice(decimalPos + 1).replace(/[.,]/g, '');
    s = intPart + '.' + decPart;
  } else {
    // No clear decimal separator: just remove commas
    s = s.replace(/,/g, '');
  }

  let n = Number(s);
  if (!Number.isFinite(n)) n = 0;
  if (negative) n = -Math.abs(n);
  return n;
}

// Try to normalise dates like "2025-12-07T..." or "07/12/2025" to YYYY-MM-DD
function normaliseDate(raw: unknown): string {
  if (raw == null) return '';

  const s = String(raw).trim();
  if (!s) return '';

  // If we already have ISO-like 2025-12-07T..., keep first 10 chars
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.slice(0, 10);
  }

  // If string already looks like YYYY-MM-DD, keep it
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(s);
  if (m) {
    let [_, dd, mm, yyyy] = m;
    if (yyyy.length === 2) {
      // naive 20xx assumption
      yyyy = '20' + yyyy;
    }
    const day = dd.padStart(2, '0');
    const month = mm.padStart(2, '0');
    return `${yyyy}-${month}-${day}`;
  }

  // Fallback: if at least 10 chars, assume YYYY-MM-DD in front
  if (s.length >= 10) {
    return s.slice(0, 10);
  }

  return s;
}

// Format date-like strings to YYYY-MM-DD using normaliseDate
function formatMaybeDate(value: unknown, fieldName: string): string {
  const lowerField = fieldName.toLowerCase();
  if (lowerField.includes('date')) {
    return normaliseDate(value);
  }
  // For fields not obviously dates, just return as string
  if (value == null) return '';
  return String(value);
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
  const trimmed = name.trim();
  if (!trimmed) return null;
  const acc = accounts.find(
    (a) => typeof a.name === 'string' && a.name.trim() === trimmed,
  );
  return acc?.id ?? null;
}

// Generate a simple id for newly created accounts
function makeId(prefix: string): string {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  );
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

  const n = parseMixedNumber(rawAmount);
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
  const date = normaliseDate(rawDate);

  // Amount (robust parsing)
  const rawAmount = row.amount ?? row.value ?? row.total ?? 0;
  const amount = parseMixedNumber(rawAmount);

  // Type (use explicit value if present, otherwise infer from amount)
  const type = resolveType(row.type, rawAmount);

  // Description / notes
  const description =
    (row.description ??
      row.notes ??
      row.memo ??
      row.category ??
      'Imported transaction') || 'Imported transaction';

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

// Ensure we have an accountId for a given account name:
// - if already in existing accounts → use that id
// - else if already created in this import → reuse id
// - else create a new account via actions.addAccount and cache the id
function ensureAccountIdForName(
  name: string,
  existingAccounts: any[],
  createdByName: Record<string, string>,
  actions: any,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Existing?
  const existingId = findExistingAccountIdByName(trimmed, existingAccounts);
  if (existingId) return existingId;

  // Already created in this import?
  if (createdByName[trimmed]) {
    return createdByName[trimmed];
  }

  // Create a new account
  const newId = makeId('acc_import');
  try {
    actions.addAccount({
      id: newId,
      name: trimmed,
    });
    createdByName[trimmed] = newId;
    return newId;
  } catch (e) {
    console.warn('Failed to auto-create account for import', trimmed, e);
    return null;
  }
}

// ---------- Pending import preview types ----------

type JsonPendingImport = {
  source: 'json';
  fileName?: string;
  importedAccounts: any[];
  importedTxs: any[];
  stats: {
    total: number;
    withAccountName: number;
    existingAccountMatch: number;
    willCreateAccount: number;
    missingAccountName: number;
  };
};

type CsvPendingImport = {
  source: 'csv';
  fileName?: string;
  rows: Record<string, any>[];
  stats: {
    total: number;
    existingAccountMatch: number;
    willCreateAccount: number;
    missingAccountName: number;
  };
};

type PendingImport = JsonPendingImport | CsvPendingImport | null;

// ---------- Component ----------

const DataExportImportScreen: React.FC<Props> = () => {
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport>(null);

  // Expo provides documentDirectory; fall back to '' just in case.
  const exportDir = (FileSystem.documentDirectory ?? '') as string;

  // ---------- EXPORT HANDLERS ----------

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

  // ---------- IMPORT PREVIEW (JSON) ----------

  const handleImportJsonPreview = async () => {
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
        setPendingImport(null);
        return;
      }

      let withAccountName = 0;
      let existingAccountMatch = 0;
      let willCreateAccount = 0;
      let missingAccountName = 0;

      for (const tx of importedTxs) {
        const accountNameFromImported =
          getAccountNameFromAccounts(tx.accountId, importedAccounts) ||
          tx.account ||
          tx.accountName ||
          '';

        if (!accountNameFromImported.trim()) {
          missingAccountName++;
          continue;
        }

        withAccountName++;

        const existingId = findExistingAccountIdByName(
          accountNameFromImported,
          accounts,
        );

        if (existingId) {
          existingAccountMatch++;
        } else {
          willCreateAccount++;
        }
      }

      const stats = {
        total: importedTxs.length,
        withAccountName,
        existingAccountMatch,
        willCreateAccount,
        missingAccountName,
      };

      setPendingImport({
        source: 'json',
        fileName: asset.name,
        importedAccounts,
        importedTxs,
        stats,
      });

      setLastStatus(
        `JSON file parsed. Preview ready below: ` +
          `${stats.existingAccountMatch} transaction(s) will go to existing accounts, ` +
          `${stats.willCreateAccount} will create new accounts, ` +
          `${stats.missingAccountName} have no account name and will be skipped.`,
      );
    } catch (err: any) {
      console.error('JSON import preview error', err);
      setLastStatus(
        `JSON import failed: ${err?.message ?? 'Unknown error occurred while reading the file.'}`,
      );
      setPendingImport(null);
    }
  };

  // ---------- IMPORT PREVIEW (CSV) ----------

  const handleImportCsvPreview = async () => {
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
        setPendingImport(null);
        return;
      }

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
        setPendingImport(null);
        return;
      }

      const rowObjs: Record<string, any>[] = [];
      let existingAccountMatch = 0;
      let willCreateAccount = 0;
      let missingAccountName = 0;

      for (const row of rows) {
        const get = (idx: number): string =>
          idx >= 0 && idx < row.length ? row[idx] : '';

        const accountNameRaw = get(accountIdx);
        const accountName = accountNameRaw ? accountNameRaw.trim() : '';

        const rawObj: Record<string, any> = {
          date: dateIdx >= 0 ? get(dateIdx) : undefined,
          account: accountName,
          amount: amountIdx >= 0 ? get(amountIdx) : undefined,
          type: typeIdx >= 0 ? get(typeIdx) : undefined,
          description: descIdx >= 0 ? get(descIdx) : undefined,
          category: categoryIdx >= 0 ? get(categoryIdx) : undefined,
        };

        // Skip completely empty/junk rows:
        const descStr = (rawObj.description || '').toString().trim();
        const amountNum = parseMixedNumber(rawObj.amount);
        const hasAnyContent =
          accountName ||
          descStr ||
          (amountNum !== 0 && !Number.isNaN(amountNum));
        if (!hasAnyContent) {
          continue;
        }

        rowObjs.push(rawObj);

        if (!accountName) {
          missingAccountName++;
          continue;
        }

        const existingId = findExistingAccountIdByName(
          accountName,
          accounts,
        );
        if (existingId) {
          existingAccountMatch++;
        } else {
          willCreateAccount++;
        }
      }

      const stats = {
        total: rowObjs.length,
        existingAccountMatch,
        willCreateAccount,
        missingAccountName,
      };

      setPendingImport({
        source: 'csv',
        fileName: asset.name,
        rows: rowObjs,
        stats,
      });

      setLastStatus(
        `CSV file parsed. Preview ready below: ` +
          `${stats.existingAccountMatch} row(s) will go to existing accounts, ` +
          `${stats.willCreateAccount} will create new accounts, ` +
          `${stats.missingAccountName} have no account name and will be skipped.`,
      );
    } catch (err: any) {
      console.error('CSV import preview error', err);
      setLastStatus(
        `CSV import failed: ${err?.message ?? 'Unknown error occurred while reading the file.'}`,
      );
      setPendingImport(null);
    }
  };

  // ---------- APPLY IMPORT (from preview) ----------

  const handleApplyImport = () => {
    if (!pendingImport) return;

    // Map to remember which new accounts we've created in this one import run
    const createdByName: Record<string, string> = {};

    if (pendingImport.source === 'json') {
      const { importedAccounts, importedTxs, stats } = pendingImport;
      let added = 0;
      let skippedNoAccountName = 0;

      for (const tx of importedTxs) {
        const accountNameFromImported =
          getAccountNameFromAccounts(
            tx.accountId,
            importedAccounts,
          ) ||
          tx.account ||
          tx.accountName ||
          '';

        const trimmedName = (accountNameFromImported || '').trim();

        if (!trimmedName) {
          skippedNoAccountName++;
          continue;
        }

        const accountId = ensureAccountIdForName(
          trimmedName,
          accounts,
          createdByName,
          actions,
        );

        if (!accountId) {
          skippedNoAccountName++;
          continue;
        }

        const txForAdd = buildTransactionFromData(tx, accountId);

        try {
          actions.addTransaction(txForAdd);
          added++;
        } catch (e) {
          console.warn('Failed to add imported JSON transaction', e);
        }
      }

      const createdCount = Object.keys(createdByName).length;

      setPendingImport(null);
      setLastStatus(
        `JSON import applied: ${added} transaction(s) merged. ` +
          (createdCount
            ? `${createdCount} new account(s) were created from the file. `
            : '') +
          (skippedNoAccountName
            ? `${skippedNoAccountName} transaction(s) skipped because they had no valid account name.`
            : `Preview had ${stats.missingAccountName} without account names; some may have been resolved if accounts changed.`),
      );
    } else if (pendingImport.source === 'csv') {
      const { rows, stats } = pendingImport;
      let added = 0;
      let skippedNoAccountName = 0;

      for (const rawObj of rows) {
        const accountName = rawObj.account;
        const trimmedName = (accountName || '').trim();

        if (!trimmedName) {
          skippedNoAccountName++;
          continue;
        }

        const accountId = ensureAccountIdForName(
          trimmedName,
          accounts,
          createdByName,
          actions,
        );

        if (!accountId) {
          skippedNoAccountName++;
          continue;
        }

        const txForAdd = buildTransactionFromData(rawObj, accountId);

        try {
          actions.addTransaction(txForAdd);
          added++;
        } catch (e) {
          console.warn('Failed to add imported CSV transaction', e);
        }
      }

      const createdCount = Object.keys(createdByName).length;

      setPendingImport(null);
      setLastStatus(
        `CSV import applied: ${added} transaction(s) merged. ` +
          (createdCount
            ? `${createdCount} new account(s) were created from the file. `
            : '') +
          (skippedNoAccountName
            ? `${skippedNoAccountName} row(s) skipped because they had no valid account name.`
            : `Preview had ${stats.missingAccountName} without account names; some may have been resolved if accounts changed.`),
      );
    }
  };

  const handleDiscardPreview = () => {
    setPendingImport(null);
    setLastStatus('Import preview discarded. No data has been changed.');
  };

  // ---------- RENDER ----------

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
          Choose a JSON backup (from DebitLens) or a CSV file. We&apos;ll parse
          it and show a preview. When you apply, transactions will be merged
          into existing accounts, and any new account names in the file will
          create new accounts automatically.
        </Text>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleImportJsonPreview}
        >
          <Text style={styles.btnSecondaryText}>
            Import from JSON backup (preview)
          </Text>
        </Pressable>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleImportCsvPreview}
        >
          <Text style={styles.btnSecondaryText}>
            Import from CSV (preview)
          </Text>
        </Pressable>
      </View>

      {/* STATUS */}
      {lastStatus ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{lastStatus}</Text>
        </View>
      ) : null}

      {/* IMPORT PREVIEW CARD */}
      {pendingImport && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Import preview</Text>
          <Text style={styles.previewMeta}>
            Source: {pendingImport.source.toUpperCase()}
          </Text>
          {pendingImport.fileName ? (
            <Text style={styles.previewMeta}>
              File: {pendingImport.fileName}
            </Text>
          ) : null}

          {pendingImport.source === 'json' ? (
            <>
              <Text style={styles.previewText}>
                Transactions in file: {pendingImport.stats.total}
              </Text>
              <Text style={styles.previewText}>
                With account name: {pendingImport.stats.withAccountName}
              </Text>
              <Text style={styles.previewText}>
                To existing accounts: {pendingImport.stats.existingAccountMatch}
              </Text>
              <Text style={styles.previewText}>
                Will create new accounts:{' '}
                {pendingImport.stats.willCreateAccount}
              </Text>
              <Text style={styles.previewText}>
                Missing account name:{' '}
                {pendingImport.stats.missingAccountName}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.previewText}>
                Rows in file: {pendingImport.stats.total}
              </Text>
              <Text style={styles.previewText}>
                To existing accounts: {pendingImport.stats.existingAccountMatch}
              </Text>
              <Text style={styles.previewText}>
                Will create new accounts:{' '}
                {pendingImport.stats.willCreateAccount}
              </Text>
              <Text style={styles.previewText}>
                Missing account name:{' '}
                {pendingImport.stats.missingAccountName}
              </Text>
            </>
          )}

          <View style={styles.previewButtonsRow}>
            <Pressable
              style={[styles.btnPrimary, styles.previewBtn]}
              onPress={handleApplyImport}
            >
              <Text style={styles.btnPrimaryText}>Apply import</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, styles.previewBtn]}
              onPress={handleDiscardPreview}
            >
              <Text style={styles.btnSecondaryText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  previewCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2933',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  previewText: {
    color: '#E5E7EB',
    fontSize: 13,
    marginTop: 4,
  },
  previewButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  previewBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
});
