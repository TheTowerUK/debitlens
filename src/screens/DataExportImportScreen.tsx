
import { Alert, /* ...other RN imports */ } from 'react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';




type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;
type DateFormatOption = 'iso' | 'uk';
type ExportDateRange = 'all' | '12m' | '90d';

type ValidationIssueLevel = 'warning' | 'error';

type ValidationIssue = {
  level: ValidationIssueLevel;
  code: string;
  message: string;
  count: number;
};


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

  // Remove thousands separators (commas / extra dots)
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
  if (value == null) return '';
  return String(value);
}

// For validation only: is this a recognisable date format?
function isValidImportDate(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;

  // ISO: 2025-12-07 or 2025-12-07T...
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return true;

  // Day-first: 07/12/2025, 7/12/25, 07-12-2025, etc.
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(s)) return true;

  return false;
}

// For CSV export: convert an ISO date to the chosen format
function formatDateForCsv(dateStr: string, format: DateFormatOption): string {
  const iso = normaliseDate(dateStr);
  if (format === 'iso') return iso;

  // uk: DD/MM/YYYY if we recognise ISO YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
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

function applyExportFilters(
  transactions: any[],
  accountId: string | 'all',
  dateRange: ExportDateRange,
): any[] {
  let result = transactions || [];

  // Account filter
  if (accountId !== 'all') {
    result = result.filter((tx) => tx.accountId === accountId);
  }

  // Date range filter
  if (dateRange !== 'all') {
    const now = new Date();
    const cutoff = new Date(now.getTime());

    if (dateRange === '12m') {
      cutoff.setFullYear(cutoff.getFullYear() - 1);
    } else if (dateRange === '90d') {
      cutoff.setDate(cutoff.getDate() - 90);
    }

    result = result.filter((tx) => {
      const dStr = normaliseDate(tx.date);
      if (!dStr) return false;
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) return false;
      return d >= cutoff;
    });
  }

  return result;
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
  issues: ValidationIssue[];
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
  issues: ValidationIssue[];
};

type PendingImport = JsonPendingImport | CsvPendingImport;

// Full restore preview
type PendingFullRestore = {
  fileName?: string;
  backupAccounts: any[];
  backupTxs: any[];
  stats: {
    currentAccounts: number;
    currentTxs: number;
    backupAccounts: number;
    backupTxs: number;
  };
};

// ---------- Component ----------

const DataExportImportScreen: React.FC<Props> = () => {
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null,
  );
  const [pendingFullRestore, setPendingFullRestore] =
    useState<PendingFullRestore | null>(null);

  // CSV export customisation
  const [csvIncludeDescription, setCsvIncludeDescription] = useState(true);
  const [csvIncludeCategory, setCsvIncludeCategory] = useState(true);
  const [csvDateFormat, setCsvDateFormat] = useState<DateFormatOption>('iso');

  // Export filters (used by both JSON and CSV exports)
  const [exportAccountId, setExportAccountId] = useState<string | 'all'>(
    'all',
  );
  const [exportDateRange, setExportDateRange] =
    useState<ExportDateRange>('all');


  // Expo provides documentDirectory; fall back to '' just in case.
  const exportDir = (FileSystem.documentDirectory ?? '') as string;

  // ---------- EXPORT HANDLERS ----------

  const handleExportJsonPress = async () => {
    try {
      const filteredTxs = applyExportFilters(
        txs as any[],
        exportAccountId,
        exportDateRange,
      );

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts, // always export all accounts
        transactions: filteredTxs,
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

const handleExportCsvPress = React.useCallback(async () => {
  try {
    const txs = state.transactions || [];

    if (!txs.length) {
      Alert.alert(
        'No transactions',
        'There are no transactions to export yet.'
      );
      return;
    }

    // Build CSV header – tweak columns to match your actual Tx shape
    const header = [
      'id',
      'date',
      'accountId',
      'type',
      'category',
      'amount',
      csvIncludeDescription ? 'description' : undefined,
    ].filter(Boolean) as string[];

    const escapeCsv = (value: unknown): string => {
      const s =
        value === null || value === undefined ? '' : String(value);
      // Escape quotes
      const escaped = s.replace(/"/g, '""');
      // Wrap in quotes so commas etc. are safe
      return `"${escaped}"`;
    };

    const rows = txs.map((t: any) => {
      const cols: (string | number | null | undefined)[] = [
        t.id,
        t.date,
        t.accountId,
        t.type,
        t.category,
        t.amount,
      ];

      if (csvIncludeDescription) {
        cols.push(t.description);
      }

      return cols.map(escapeCsv).join(',');
    });

    const csvString = [header.join(','), ...rows].join('\n');

    // File name like base44-transactions-2025-12-08.csv
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `base44-transactions-${today}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;

    // Save CSV
    await FileSystem.writeAsStringAsync(fileUri, csvString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // If sharing is not available, at least tell the user where the file is
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(
        'Exported to file',
        `Your CSV has been saved here:\n\n${fileUri}\n\nSharing is not supported on this device/emulator.`
      );
      return;
    }

    // Share via Files / iCloud / Drive / Mail etc.
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Share transactions CSV',
      UTI: 'public.comma-separated-values-text',
    });
  } catch (err) {
    console.error('CSV export/share failed', err);
    Alert.alert(
      'Export failed',
      'There was a problem exporting your CSV. Please try again.'
    );
  }
}, [state.transactions, csvIncludeDescription]);


  // ---------- IMPORT PREVIEW (JSON MERGE) ----------

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
      let zeroAmount = 0;
      let invalidDateCount = 0;

      for (const tx of importedTxs) {
        const accountNameFromImported =
          getAccountNameFromAccounts(tx.accountId, importedAccounts) ||
          tx.account ||
          tx.accountName ||
          '';

        const rawDate =
          tx.date ??
          tx.txnDate ??
          tx.transactionDate ??
          tx.createdAt ??
          tx.updatedAt;

        if (!isValidImportDate(rawDate)) {
          invalidDateCount++;
        }

        const amountNum = parseMixedNumber(
          tx.amount ?? tx.value ?? tx.total,
        );
        if (amountNum === 0) zeroAmount++;

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

      const issues: ValidationIssue[] = [];

            if (invalidDateCount > 0) {
        issues.push({
          level: 'error',
          code: 'invalidDate',
          message:
            `${invalidDateCount} transaction(s) have an invalid date format. Fix the dates in the file or remove those rows before importing.`,
          count: invalidDateCount,
        });
      }

      if (missingAccountName > 0) {
        issues.push({
          level: 'warning',
          code: 'missingAccount',
          message:
            `${missingAccountName} transaction(s) have no account name and will be skipped on merge.`,
          count: missingAccountName,
        });
      }

      if (willCreateAccount > 0) {
        issues.push({
          level: 'warning',
          code: 'newAccounts',
          message:
            `${willCreateAccount} transaction(s) refer to unknown account names and will create new accounts if applied.`,
          count: willCreateAccount,
        });
      }

      if (zeroAmount > 0) {
        issues.push({
          level: 'warning',
          code: 'zeroAmount',
          message:
            `${zeroAmount} transaction(s) have an amount of 0. They will still be imported.`,
          count: zeroAmount,
        });
      }

      const pending: JsonPendingImport = {
        source: 'json',
        fileName: asset.name,
        importedAccounts,
        importedTxs,
        stats,
        issues,
      };

      setPendingImport(pending);
      setPendingFullRestore(null);

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

  // ---------- IMPORT PREVIEW (CSV MERGE) ----------

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
      let zeroAmount = 0;
      let invalidDateCount = 0;


      for (const row of rows) {
        const get = (idx: number): string =>
          idx >= 0 && idx < row.length ? row[idx] : '';

        const accountNameRaw = get(accountIdx);
        const accountName = accountNameRaw ? accountNameRaw.trim() : '';

        const dateRaw = dateIdx >= 0 ? get(dateIdx) : undefined;
        if (!isValidImportDate(dateRaw)) {
          invalidDateCount++;
        }

        const amountRaw =
          amountIdx >= 0 ? get(amountIdx) : undefined;
        const amountNum = parseMixedNumber(amountRaw);
        if (amountNum === 0) zeroAmount++;

        const rawObj: Record<string, any> = {
          date: dateRaw,
          account: accountName,
          amount: amountRaw,

          type: typeIdx >= 0 ? get(typeIdx) : undefined,
          description: descIdx >= 0 ? get(descIdx) : undefined,
          category: categoryIdx >= 0 ? get(categoryIdx) : undefined,
        };

        // Skip completely empty/junk rows:
        const descStr = (rawObj.description || '').toString().trim();
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

      const issues: ValidationIssue[] = [];

      if (invalidDateCount > 0) {
        issues.push({
          level: 'error',
          code: 'invalidDate',
          message:
            `${invalidDateCount} row(s) have an invalid date format. Fix the dates in the file or remove those rows before importing.`,
          count: invalidDateCount,
        });
      }

      if (missingAccountName > 0) {
        issues.push({
          level: 'warning',
          code: 'missingAccount',
          message:
            `${missingAccountName} row(s) have no account name and will be skipped on merge.`,
          count: missingAccountName,
        });
      }

      if (willCreateAccount > 0) {
        issues.push({
          level: 'warning',
          code: 'newAccounts',
          message:
            `${willCreateAccount} row(s) refer to unknown account names and will create new accounts if applied.`,
          count: willCreateAccount,
        });
      }

      if (zeroAmount > 0) {
        issues.push({
          level: 'warning',
          code: 'zeroAmount',
          message:
            `${zeroAmount} row(s) have an amount of 0. They will still be imported.`,
          count: zeroAmount,
        });
      }

      const pending: CsvPendingImport = {
        source: 'csv',
        fileName: asset.name,
        rows: rowObjs,
        stats,
        issues,
      };

      setPendingImport(pending);
      setPendingFullRestore(null);

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

  // ---------- FULL RESTORE PREVIEW (JSON ONLY) ----------

  const handleFullRestoreJsonPreview = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLastStatus('Full restore cancelled before file selection.');
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        setLastStatus(
          'Full restore failed: No file selected or invalid file.',
        );
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
        console.error('Full restore parse error', parseErr);
        setLastStatus(
          'Full restore failed: Selected file is not valid JSON or is corrupted.',
        );
        return;
      }

      const backupAccounts = Array.isArray(parsed.accounts)
        ? parsed.accounts
        : [];
      const backupTxs = Array.isArray(parsed.transactions)
        ? parsed.transactions
        : [];

      if (!backupAccounts.length && !backupTxs.length) {
        setLastStatus(
          'Full restore file parsed, but no accounts or transactions were found.',
        );
        setPendingFullRestore(null);
        return;
      }

      const stats = {
        currentAccounts: accounts.length,
        currentTxs: txs.length,
        backupAccounts: backupAccounts.length,
        backupTxs: backupTxs.length,
      };

      setPendingFullRestore({
        fileName: asset.name,
        backupAccounts,
        backupTxs,
        stats,
      });
      setPendingImport(null);

      setLastStatus(
        `Full restore preview ready. Current data: ${stats.currentAccounts} account(s), ${stats.currentTxs} transaction(s). ` +
          `Backup: ${stats.backupAccounts} account(s), ${stats.backupTxs} transaction(s).`,
      );
    } catch (err: any) {
      console.error('Full restore preview error', err);
      setLastStatus(
        `Full restore failed: ${err?.message ?? 'Unknown error occurred while reading the file.'}`,
      );
      setPendingFullRestore(null);
    }
  };

  const handleApplyFullRestore = () => {
    if (!pendingFullRestore) return;

    const { backupAccounts, backupTxs, stats } = pendingFullRestore;

    const anyActions = actions as any;
    const restoreFn = anyActions.fullRestoreFromBackup;

    if (typeof restoreFn !== 'function') {
      setLastStatus(
        'Full restore is not wired into app state yet. ' +
          'Please implement actions.fullRestoreFromBackup({ accounts, transactions }) in AppContext before using this feature.',
      );
      setPendingFullRestore(null);
      return;
    }

    try {
      restoreFn({
        accounts: backupAccounts,
        transactions: backupTxs,
      });

      setLastStatus(
        `Full restore applied: replaced ${stats.currentAccounts} account(s) / ${stats.currentTxs} transaction(s) ` +
          `with backup (${stats.backupAccounts} account(s), ${stats.backupTxs} transaction(s)).`,
      );
    } catch (err: any) {
      console.error('Full restore apply error', err);
      setLastStatus(
        `Full restore failed while applying backup: ${err?.message ?? 'Unknown error.'}`,
      );
    } finally {
      setPendingFullRestore(null);
    }
  };

  const handleCancelFullRestore = () => {
    setPendingFullRestore(null);
    setLastStatus(
      'Full restore preview discarded. No data has been changed.',
    );
  };

  // ---------- APPLY IMPORT (MERGE) ----------

  const handleApplyImport = () => {
    if (!pendingImport) return;

    // Map to remember which new accounts we've created in this one import run
    const createdByName: Record<string, string> = {};

    if (pendingImport.source === 'json') {
      const { importedAccounts, importedTxs, stats } =
        pendingImport as JsonPendingImport;
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
      const { rows, stats } = pendingImport as CsvPendingImport;
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

  const hasImportErrors =
    !!pendingImport &&
    pendingImport.issues &&
    pendingImport.issues.some((i) => i.level === 'error');


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

        {/* CSV export */}
        <Pressable style={styles.btnSecondary} onPress={handleExportCsvPress}>
          <Text style={styles.btnSecondaryText}>
            Export transactions as CSV (file)
          </Text>
        </Pressable>
        
        {/* JSON export */}
        <Pressable style={styles.btnPrimary} onPress={handleExportJsonPress}>
          <Text style={styles.btnPrimaryText}>Export as JSON (file)</Text>
        </Pressable>


      {/* Export filters + CSV options */}
      <View style={styles.optionsBox}>
        <Text style={styles.optionsTitle}>Export filters</Text>
        <Text style={styles.optionHint}>
          Filters apply to transactions in both JSON and CSV exports.
          Accounts are always fully included in JSON backups.
        </Text>

        {/* Account filter */}
        <Text style={[styles.optionLabel, { marginTop: 6 }]}>Account</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.accountChipsScroll}
        >
          <Pressable
            style={[
              styles.chip,
              exportAccountId === 'all' && styles.chipActive,
            ]}
            onPress={() => setExportAccountId('all')}
          >
            <Text
              style={[
                styles.chipText,
                exportAccountId === 'all' && styles.chipTextActive,
              ]}
            >
              All accounts
            </Text>
          </Pressable>

          {accounts.map((a) => (
            <Pressable
              key={a.id}
              style={[
                styles.chip,
                exportAccountId === a.id && styles.chipActive,
              ]}
              onPress={() => setExportAccountId(a.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  exportAccountId === a.id && styles.chipTextActive,
                ]}
              >
                {a.name || 'Unnamed'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Date range filter */}
        <Text style={[styles.optionLabel, { marginTop: 8 }]}>
          Date range
        </Text>
        <View style={styles.dateRangeRow}>
          <Pressable
            style={[
              styles.dateFormatBtn,
              exportDateRange === 'all' && styles.dateFormatBtnActive,
            ]}
            onPress={() => setExportDateRange('all')}
          >
            <Text
              style={[
                styles.dateFormatText,
                exportDateRange === 'all' &&
                  styles.dateFormatTextActive,
              ]}
            >
              All time
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.dateFormatBtn,
              exportDateRange === '12m' && styles.dateFormatBtnActive,
            ]}
            onPress={() => setExportDateRange('12m')}
          >
            <Text
              style={[
                styles.dateFormatText,
                exportDateRange === '12m' &&
                  styles.dateFormatTextActive,
              ]}
            >
              Last 12 months
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.dateFormatBtn,
              exportDateRange === '90d' && styles.dateFormatBtnActive,
            ]}
            onPress={() => setExportDateRange('90d')}
          >
            <Text
              style={[
                styles.dateFormatText,
                exportDateRange === '90d' &&
                  styles.dateFormatTextActive,
              ]}
            >
              Last 90 days
            </Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.optionsTitle}>CSV columns</Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Include description</Text>
          <Switch
            value={csvIncludeDescription}
            onValueChange={setCsvIncludeDescription}
          />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Include category</Text>
          <Switch
            value={csvIncludeCategory}
            onValueChange={setCsvIncludeCategory}
          />
        </View>

        <Text style={[styles.optionLabel, { marginTop: 8 }]}>
          Date format
        </Text>
        <View style={styles.dateFormatRow}>
          <Pressable
            style={[
              styles.dateFormatBtn,
              csvDateFormat === 'iso' && styles.dateFormatBtnActive,
            ]}
            onPress={() => setCsvDateFormat('iso')}
          >
            <Text
              style={[
                styles.dateFormatText,
                csvDateFormat === 'iso' &&
                  styles.dateFormatTextActive,
              ]}
            >
              YYYY-MM-DD
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.dateFormatBtn,
              csvDateFormat === 'uk' && styles.dateFormatBtnActive,
            ]}
            onPress={() => setCsvDateFormat('uk')}
          >
            <Text
              style={[
                styles.dateFormatText,
                csvDateFormat === 'uk' &&
                  styles.dateFormatTextActive,
              ]}
            >
              DD/MM/YYYY
            </Text>
          </Pressable>
        </View>
      </View>

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
            Import from JSON backup (preview / merge)
          </Text>
        </Pressable>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleImportCsvPreview}
        >
          <Text style={styles.btnSecondaryText}>
            Import from CSV (preview / merge)
          </Text>
        </Pressable>

        <View style={styles.fullRestoreBox}>
          <Text style={styles.fullRestoreLabel}>
            Full restore (danger – replaces all data)
          </Text>
          <Pressable
            style={styles.btnDanger}
            onPress={handleFullRestoreJsonPreview}
          >
            <Text style={styles.btnDangerText}>
              Restore from JSON backup (full replace)
            </Text>
          </Pressable>
          <Text style={styles.fullRestoreHint}>
            Uses the JSON backup to completely replace your current accounts and
            transactions. You&apos;ll see a summary before applying. This
            requires actions.fullRestoreFromBackup(...) to be wired in
            AppContext.
          </Text>
        </View>
      </View>

      {/* STATUS */}
      {lastStatus ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{lastStatus}</Text>
        </View>
      ) : null}

      {/* IMPORT PREVIEW CARD (MERGE) */}
      {pendingImport && (
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Import preview (merge)</Text>
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
                With account name:{' '}
                {(pendingImport as JsonPendingImport).stats.withAccountName}
              </Text>
              <Text style={styles.previewText}>
                To existing accounts:{' '}
                {pendingImport.stats.existingAccountMatch}
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
                To existing accounts:{' '}
                {pendingImport.stats.existingAccountMatch}
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

          {/* Validation section */}
          {pendingImport.issues && pendingImport.issues.length > 0 && (
            <View style={styles.validationBox}>
              <Text style={styles.validationTitle}>Validation</Text>
              {pendingImport.issues.map((issue, idx) => (
                <Text
                  key={issue.code + String(idx)}
                  style={[
                    styles.validationText,
                    issue.level === 'error' &&
                      styles.validationTextError,
                  ]}
                >
                  {issue.level.toUpperCase()}: {issue.message}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.previewButtonsRow}>
            <Pressable
              style={[
                styles.btnPrimary,
                styles.previewBtn,
                hasImportErrors && { opacity: 0.4 },
              ]}
              onPress={hasImportErrors ? undefined : handleApplyImport}
              disabled={hasImportErrors}
            >
              <Text style={styles.btnPrimaryText}>
                {hasImportErrors ? 'Resolve errors above' : 'Apply merge'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, styles.previewBtn]}
              onPress={handleDiscardPreview}
            >
              <Text style={styles.btnSecondaryText}>Discard</Text>
            </Pressable>
          </View>

          {hasImportErrors && (
            <Text style={styles.validationTextError}>
              Fix the error(s) in your file and re-import before you can apply
              this merge.
            </Text>
          )}

        </View>
      )}

      {/* FULL RESTORE PREVIEW CARD */}
      {pendingFullRestore && (
        <View style={styles.previewCardDanger}>
          <Text style={styles.previewTitleDanger}>Full restore preview</Text>
          <Text style={styles.previewMeta}>
            This will replace ALL current accounts and transactions.
          </Text>
          {pendingFullRestore.fileName ? (
            <Text style={styles.previewMeta}>
              File: {pendingFullRestore.fileName}
            </Text>
          ) : null}

          <Text style={styles.previewText}>
            Current data: {pendingFullRestore.stats.currentAccounts} account(s),{' '}
            {pendingFullRestore.stats.currentTxs} transaction(s)
          </Text>
          <Text style={styles.previewText}>
            Backup data: {pendingFullRestore.stats.backupAccounts} account(s),{' '}
            {pendingFullRestore.stats.backupTxs} transaction(s)
          </Text>

          <View style={styles.previewButtonsRow}>
            <Pressable
              style={[styles.btnDanger, styles.previewBtn]}
              onPress={handleApplyFullRestore}
            >
              <Text style={styles.btnDangerText}>Apply full restore</Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondary, styles.previewBtn]}
              onPress={handleCancelFullRestore}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
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
  btnDanger: {
    backgroundColor: '#B91C1C',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDangerText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
  previewCardDanger: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1F2933',
    borderWidth: 1,
    borderColor: '#B91C1C',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewTitleDanger: {
    color: '#FCA5A5',
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
  optionsBox: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2933',
  },
  optionsTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionLabel: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  dateFormatRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  dateFormatBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  dateFormatBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dateFormatText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '500',
  },
  dateFormatTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fullRestoreBox: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2933',
  },
  fullRestoreLabel: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  fullRestoreHint: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  validationBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1F2933',
  },
  validationTitle: {
    color: '#FACC15',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  validationText: {
    color: '#FDE68A',
    fontSize: 12,
    marginTop: 2,
  },
  validationTextError: {
    color: '#FCA5A5',
  },
    optionHint: {
    color: '#6B7280',
    fontSize: 11,
    marginBottom: 4,
  },
  accountChipsScroll: {
    marginTop: 4,
    marginBottom: 4,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: '#0B1018',
  },
  chipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  divider: {
    marginTop: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2933',
  },
  dateRangeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },

});
