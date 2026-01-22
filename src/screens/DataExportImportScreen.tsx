// src/screens/DataExportImportScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

import {
  useApp,
  type Account,
  type Transaction,
  type TransactionType,
  type RecurringItem,
  type RecurringFrequency,
} from '../state/AppContext';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as theme } from '../theme/colors';

import { createBackupV1, parseAndValidateBackup, type BackupLatest } from '../utils/backup';
import type { ImportRow } from '../utils/validation';

import { importCsvRowsWithValidation, alertImportSummary } from '../utils/importCsv';

const FS: any = FileSystem as any;
const norm = (s: string) => s.trim().toLowerCase();

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

type BackupPayload = {
  accounts?: any[];
  transactions?: any[];
  recurring?: any[];
};

function isArray(v: any): v is any[] {
  return Array.isArray(v);
}

function buildCsvTemplate(): string {
  const header = ['Date', 'Account', 'Amount', 'Description', 'Merchant', 'Category', 'Type'];
  const instructionRow = [
    'YYYY-MM-DD',
    'Account name',
    '-12.34',
    'Transaction description',
    'Merchant or Payee',
    'Category',
    'Expense|Income|Transfer',
  ];

  const esc = (v: string) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  return [header.map(esc).join(','), instructionRow.map(esc).join(',')].join('\n') + '\n';
}

function buildIdSet(items: any[]) {
  const s = new Set<string>();
  for (const x of items) if (x && typeof x.id === 'string') s.add(x.id);
  return s;
}

function validateBackup(payload: BackupPayload) {
  const issues: string[] = [];

  if (!isArray(payload.accounts)) issues.push('accounts is not an array');
  if (!isArray(payload.transactions)) issues.push('transactions is not an array');
  if (!isArray(payload.recurring)) issues.push('recurring is not an array');

  const accountIds = buildIdSet(payload.accounts || []);
  let badRefs = 0;
  for (const t of payload.transactions || []) {
    const aid = t?.accountId;
    if (aid && typeof aid === 'string' && !accountIds.has(aid)) badRefs++;
  }
  if (badRefs > 0) issues.push(`${badRefs} transactions reference missing accounts`);

  return issues;
}

/* ===========================
   CSV helpers
=========================== */

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvUnescapeCell(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function parseCsvLines(raw: string): string[][] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const rows: string[][] = [];

  for (const line of lines) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(csvUnescapeCell(current));
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(csvUnescapeCell(current));
    rows.push(cells);
  }

  return rows;
}

/* ===========================
   CSV restore helpers
=========================== */

type RestoreMode = 'merge' | 'replace';

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeDateToISODate(input: string): string {
  const s = String(input || '').trim();
  if (!s) return new Date().toISOString().slice(0, 10);

  // already ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${mm}-${dd}`;
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);

  return new Date().toISOString().slice(0, 10);
}

function normalizeType(typeRaw: string, amountRaw: number): 'income' | 'expense' {
  const t = String(typeRaw || '').trim().toLowerCase();
  if (t === 'income' || t === 'credit' || t === 'in') return 'income';
  if (t === 'expense' || t === 'debit' || t === 'out') return 'expense';

  if (amountRaw < 0) return 'expense';
  if (amountRaw > 0) return 'income';
  return 'expense';
}

/* ===========================
   File pick/read + write/share
=========================== */

async function pickAndReadTextFile(options: {
  types: string[];
  fallbackName: string;
}): Promise<{ text: string; filename: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: options.types,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (res.canceled) return null;

  const asset = res.assets?.[0];
  if (!asset?.uri) throw new Error('No file selected.');

  const filename = asset.name || options.fallbackName;

  const dest = `${FileSystem.cacheDirectory}${filename}`;
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {}

  await FileSystem.copyAsync({ from: asset.uri, to: dest });

  const text = await FileSystem.readAsStringAsync(dest, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { text, filename };
}

async function writeAndShareFile(filename: string, contents: string, mimeType: string) {
  const baseDir: string | undefined = FS.documentDirectory;
  if (!baseDir) throw new Error('File system directory not available.');

  const uri = baseDir + filename;

  if (!FS.writeAsStringAsync) {
    throw new Error('expo-file-system is not available. Install expo-file-system.');
  }

  await FS.writeAsStringAsync(uri, contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Save / Share file' });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
}

/* ===========================
   Types
=========================== */

type CsvImportStats = {
  importedCount: number;
  createdAccountsCount: number;
  skippedUnknownAccount: number;
  skippedBadAmount: number;
  skippedMissingAccountName: number;
  skippedCouldNotCreateAccount: number;
  skippedDuplicate?: number;
  finishedAt: string; // ISO
  source: 'file' | 'manual';
  operation?: 'import' | 'restore';
  mode?: RestoreMode;
};

const CSV_STATS_KEY = 'debitlens:lastCsvImportStats:v1';

  function limitLines(text: string, maxLines: number) {
    const lines = String(text || '').split(/\r?\n/);
    if (lines.length <= maxLines) return { text: String(text || ''), truncated: false, total: lines.length };
    return {
      text: lines.slice(0, maxLines).join('\n'),
      truncated: true,
      total: lines.length,
    };
  }

  function PreviewText({
    enabled,
    text,
    maxLines,
    style,
    hintStyle,
  }: {
    enabled: boolean;
    text: string;
    maxLines: number;
    style: any;
    hintStyle: any;
  }) {
    if (!enabled || !text) return null;
    const limited = limitLines(text, maxLines);
    return (
      <>
        <Text selectable style={style}>
          {limited.text}
        </Text>
        {limited.truncated ? (
          <Text style={hintStyle}>Preview truncated: {limited.total} total lines.</Text>
        ) : null}
      </>
    );
  }



export default function DataExportImportScreen(_props: Props) {

  const { state, actions } = useApp();

  const accounts: Account[] = Array.isArray(state?.accounts) ? state.accounts : [];
  const txs: Transaction[] = Array.isArray(state?.transactions) ? state.transactions : [];
  const recurring: RecurringItem[] = Array.isArray((state as any)?.recurring) ? (state as any).recurring : [];
  const budgets = Array.isArray((state as any)?.budgets) ? (state as any).budgets : [];

  const [lastStatus, setLastStatus] = useState<string>('');

  /* ===========================
    JSON BACKUP (EXPORT + RESTORE)
  =========================== */

  const [jsonPreview, setJsonPreview] = useState<BackupLatest | null>(null);
  const [jsonRestoreMode, setJsonRestoreMode] = useState<'replace' | 'merge'>('replace');

  const handleExportJsonFile = async () => {
    try {
      const backup = createBackupV1({
        accounts,
        transactions: txs,
        recurring,
      });

      const json = JSON.stringify(backup, null, 2);

      const filename = `DebitLens_Backup_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.json`;

      await writeAndShareFile(filename, json, 'application/json');
      setLastStatus('Backup JSON exported to Files (via Share).');
    } catch (err: any) {
      console.error(err);
      setLastStatus(`JSON export failed: ${String(err?.message ?? err)}`);
      Alert.alert('Export failed', 'Could not export JSON backup.');
    }
  };

  const handlePickJsonBackup = async () => {
    try {
      setJsonPreview(null);
      setLastStatus('');

      const picked = await pickAndReadTextFile({
        types: ['application/json', 'text/json', 'text/plain', '*/*'],
        fallbackName: 'backup.json',
      });

      if (!picked) {
        setLastStatus('File selection cancelled.');
        return;
      }

      const parsed = parseAndValidateBackup(picked.text);
      setJsonPreview(parsed);
      setLastStatus(`Loaded JSON backup v${parsed.version} (${parsed.exportedAt.slice(0, 10)}).`);
    } catch (err: any) {
      console.error(err);
      setLastStatus(`JSON import failed: ${String(err?.message ?? err)}`);
      Alert.alert('Import failed', 'Could not read/parse JSON backup.');
    }
  };

  const applyJsonReplace = () => {
    if (!jsonPreview) return;

    actions.replaceAllData({
      accounts: jsonPreview.app.accounts,
      transactions: jsonPreview.app.transactions,
      recurring: jsonPreview.app.recurring,
      budgets,
    });
  };

  const applyJsonMerge = () => {
    if (!jsonPreview) return;

    const existingAccounts = accounts;
    const existingTxs = txs;
    const existingRecurring = recurring;

    const accIds = new Set(existingAccounts.map((a) => a.id));
    const txIds = new Set(existingTxs.map((t) => t.id));
    const recIds = new Set(existingRecurring.map((r) => r.id));

    const addAccounts = jsonPreview.app.accounts.filter((a) => a?.id && !accIds.has(a.id));
    const addTxs = jsonPreview.app.transactions.filter((t) => t?.id && !txIds.has(t.id));
    const addRecurring = jsonPreview.app.recurring.filter((r) => r?.id && !recIds.has(r.id));

    actions.replaceAllData({
      accounts: [...existingAccounts, ...addAccounts],
      transactions: [...existingTxs, ...addTxs],
      recurring: [...existingRecurring, ...addRecurring],
      budgets,
    });
  };

  const handleApplyJsonRestore = () => {
    if (!jsonPreview) return;

    const modeLabel = jsonRestoreMode === 'replace' ? 'REPLACE' : 'MERGE';
    const body =
      jsonRestoreMode === 'replace'
        ? 'This will REPLACE your current accounts, transactions, and recurring items.'
        : 'This will MERGE by adding only items with NEW ids. Existing items are kept (no overwrites).';

    Alert.alert('Confirm restore', `${body}\n\nMode: ${modeLabel}\nContinue?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        style: 'destructive',
        onPress: () => {
          if (jsonRestoreMode === 'replace') applyJsonReplace();
          else applyJsonMerge();

          setJsonPreview(null);
          setLastStatus(`JSON restore applied (${jsonRestoreMode}).`);
        },
      },
    ]);
  };

  /* ===========================
     CSV EXPORT
  =========================== */

  const [csvIncludeDescription, setCsvIncludeDescription] = useState<boolean>(true);
  const [csvIncludeAccountName, setCsvIncludeAccountName] = useState<boolean>(true);

  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) {
      if (a?.id) map[a.id] = a.name ?? a.id;
    }
    return map;
  }, [accounts]);

  const [exportCsvText, setExportCsvText] = useState<string>('');
  const [csvExportPreview, setCsvExportPreview] = useState<string>('');
  const [csvExportPreviewSourceName, setCsvExportPreviewSourceName] = useState<string>('');

  // Track generation states for visual feedback
  const isTemplateGenerated = useMemo(() => {
    return !!csvExportPreview && 
           ((csvExportPreviewSourceName || '').toLowerCase().includes('template') ||
            csvExportPreview.startsWith('Date,Account,Amount,Description,Merchant,Category,Type'));
  }, [csvExportPreview, csvExportPreviewSourceName]);

  const isTransactionsCsvGenerated = useMemo(() => {
    return !!exportCsvText.trim();
  }, [exportCsvText]);

  const handleGenerateCsvTemplate = useCallback(() => {
    const csv = buildCsvTemplate();
    setCsvExportPreview(csv);
    setCsvExportPreviewSourceName('DebitLens CSV Template');
    setLastStatus('Template generated. You can now export/share it.');
  }, []);

  const handleExportCsvPreview = async () => {
    try {
      if (!csvExportPreview.trim()) {
        Alert.alert('CSV not ready', 'Generate the template first.');
        setLastStatus('CSV not ready. Generate template first.');
        return;
      }

      const isTemplate =
        (csvExportPreviewSourceName || '').toLowerCase().includes('template') ||
        csvExportPreview.startsWith('Date,Account,Amount,Description,Category,Type');

      const filename = isTemplate
        ? 'DebitLens-CSV-Template.csv'
        : `DebitLens_CSV_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;

      await writeAndShareFile(filename, csvExportPreview, 'text/csv');
      setLastStatus(isTemplate ? 'CSV template exported to Files (via Share).' : 'CSV exported to Files (via Share).');
    } catch (err: any) {
      console.error(err);
      setLastStatus(`CSV export failed: ${String(err?.message ?? err)}`);
      Alert.alert('Export failed', 'Could not export CSV file.');
    }
  };

  const handleGenerateCsv = () => {
    if (!txs.length) {
      Alert.alert('No transactions', 'There are no transactions to export.');
      setLastStatus('No transactions to export.');
      return;
    }

    const headers = ['Date', 'Account', 'Amount', 'Description', 'Merchant', 'Category', 'Type'];
    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(','));

    for (const t of txs) {
      const accountCell = csvIncludeAccountName ? accountNameById[t.accountId] ?? '' : t.accountId ?? '';

      const amountSigned =
        String(t.type).toLowerCase() === 'expense'
          ? -Math.abs(Number(t.amount ?? 0))
          : Number(t.amount ?? 0);

      const typeCell =
        String(t.type).toLowerCase() === 'income'
          ? 'Income'
          : String(t.type).toLowerCase() === 'transfer'
            ? 'Transfer'
            : 'Expense';

      const row: (string | number)[] = [
        t.date ?? '',
        accountCell,
        amountSigned,
        csvIncludeDescription ? ((t as any).description ?? (t as any).name ?? '') : '',
        (t as any).merchant ?? '',
        (t as any).category ?? '',
        typeCell,
      ];

      lines.push(row.map(csvEscape).join(','));
    }

    const csv = lines.join('\n') + '\n';
    setExportCsvText(csv);
    setLastStatus('Transactions CSV generated. You can export it to Files below.');
  };

  const handleExportCsvFile = async () => {
    try {
      if (!exportCsvText.trim()) {
        Alert.alert('CSV not ready', 'Generate the transactions CSV first.');
        return;
      }

      const filename = `DebitLens_Transactions_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.csv`;

      await writeAndShareFile(filename, exportCsvText, 'text/csv');
      setLastStatus('Transactions CSV exported to Files (via Share).');
    } catch (err: any) {
      console.error(err);
      setLastStatus(`CSV export failed: ${String(err?.message ?? err)}`);
      Alert.alert('Export failed', 'Could not export CSV file.');
    }
  };

  /* ===========================
     CSV IMPORT / RESTORE
  =========================== */

  const [importCsvText, setImportCsvText] = useState<string>('');
  const [csvHasHeaderRow, setCsvHasHeaderRow] = useState<boolean>(true);

  const [csvPreview, setCsvPreview] = useState<string>('');
  const [csvPreviewSourceName, setCsvPreviewSourceName] = useState<string>('');

  const [lastImportSummary, setLastImportSummary] = useState<string>('');
  const [createMissingAccounts, setCreateMissingAccounts] = useState<boolean>(false);
  const [importSource, setImportSource] = useState<'manual' | 'file' | null>(null);

  const [csvRestoreMode, setCsvRestoreMode] = useState<RestoreMode>('merge');
  const [lastCsvStats, setLastCsvStats] = useState<CsvImportStats | null>(null);

  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [previewMaxLines, setPreviewMaxLines] = useState(100);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CSV_STATS_KEY);
        if (raw) setLastCsvStats(JSON.parse(raw));
      } catch {
        // ignore
      }
    })();
  }, []);

  const knownAccountNames = useMemo(
    () =>
      new Set(
        accounts
          .map((a) => (a?.name ? a.name.trim().toLowerCase() : ''))
          .filter(Boolean)
      ),
    [accounts]
  );


  const handlePickCsvFile = async () => {
    try {
      setCsvHasHeaderRow(true);

      const picked = await pickAndReadTextFile({
        types: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'],
        fallbackName: 'import.csv',
      });

      if (!picked) {
        setLastStatus('File selection cancelled.');
        return;
      }

      setImportCsvText(picked.text);
      setImportSource('file');

      setCsvPreview('');
      setCsvPreviewSourceName('');
      setLastImportSummary('');

      setLastStatus(`Loaded CSV from file: ${picked.filename}. Preview, import, or restore it.`);
    } catch (err: any) {
      console.error('Error picking CSV file', err);
      Alert.alert('File error', 'Something went wrong while reading the CSV file.');
      setLastStatus(`File error: ${String(err?.message ?? err)}`);
    }
  };

const handleImportCsvPress = async () => {
  if (!importCsvText.trim()) {
    setLastStatus('Paste CSV text or pick a file first.');
    return;
  }

  try {
    // 1) Parse rows again (import should not depend on preview state)
    const rows = parseCsvLines(importCsvText);
    if (!rows.length) {
      setLastStatus('CSV parsed but contains no rows.');
      return;
    }

    const [firstRow, ...restRows] = rows;
    let dataRows = rows;
    let headerRow: string[] | null = null;

    if (csvHasHeaderRow) {
      headerRow = firstRow;
      dataRows = restRows;
    }

    // 2) Detect columns (same logic as preview)
    let accountColIndex = -1;
    let categoryColIndex = -1;
    let amountColIndex = -1;
    let dateColIndex = -1;
    let descColIndex = -1;
    let merchantColIndex = -1;

    if (headerRow) {
      const headerLower = headerRow.map((h) => String(h).trim().toLowerCase());
      const findOneOf = (candidates: string[]) =>
        headerLower.findIndex((h) => candidates.includes(h));

      dateColIndex = findOneOf(['date', 'txn_date', 'transaction_date', 'tx_date']);
      accountColIndex = findOneOf(['account', 'account_name', 'account name']);
      amountColIndex = findOneOf(['amount', 'value', 'amt']);
      descColIndex = findOneOf([
        'description',
        'desc',
        'details',
        'note',
      ]);
      merchantColIndex = findOneOf(['merchant', 'payee', 'name']);
      categoryColIndex = findOneOf(['category', 'cat', 'category_name', 'category name']);
    }

    // 3) Build accountName -> accountId map from existing accounts
    const accountNameToId = new Map<string, string>();
    for (const a of accounts) {
      const n = (a?.name ?? '').trim();
      if (n) accountNameToId.set(n, a.id);
    }

    // Local helper: resolve account name to id (optionally auto-create)
    let createdAccounts = 0;

    const resolveAccountId = (rawName: unknown): string => {
      const displayName = String(rawName ?? '').trim();
      if (!displayName) return '';

      const key = norm(displayName);

      const existing = accountNameToId.get(key);
      if (existing) return existing;

      if (!createMissingAccounts) return '';

      const newAcc = actions.addAccount({ name: displayName } as any);
      createdAccounts += 1;

      accountNameToId.set(key, newAcc.id);
      return newAcc.id;
    };


    // 4) Map CSV rows -> ImportRow with resolved accountId
    // If detection fails, fallback to assumed order:
    // date | account | amount | description | merchant | category
    const fallback = {
      date: 0,
      account: 1,
      amount: 2,
      desc: 3,
      merchant: 4,
      category: 5,
    };

    const getCell = (row: string[], idx: number) =>
      idx >= 0 && idx < row.length ? row[idx] : '';

    const parsedRows: ImportRow[] = dataRows.map((r) => {
      const dateCell = getCell(r, dateColIndex >= 0 ? dateColIndex : fallback.date);
      const accountCell = getCell(r, accountColIndex >= 0 ? accountColIndex : fallback.account);
      const amountCell = getCell(r, amountColIndex >= 0 ? amountColIndex : fallback.amount);
      const descCell = getCell(r, descColIndex >= 0 ? descColIndex : fallback.desc);
      const merchantCell = getCell(r, merchantColIndex >= 0 ? merchantColIndex : fallback.merchant);
      const categoryCell = getCell(r, categoryColIndex >= 0 ? categoryColIndex : fallback.category);

      const accountId = resolveAccountId(accountCell);

      return {
        date: dateCell,
        accountId, // now mapped or newly created
        amount: amountCell,
        description: descCell,
        merchant: merchantCell || undefined,
        category: categoryCell,
        // type omitted -> inferred from amount sign (warning)
      };
    });

    // 5) Import with validation + transparency
    const knownIds = new Set(accounts.map((a) => a.id));
    for (const id of accountNameToId.values()) knownIds.add(id);

    const summary = importCsvRowsWithValidation({
      rows: parsedRows,
      accounts: Array.from(knownIds).map((id) => ({ id })),
      actions,
    });


    // 6) User feedback + persistence
    const createdNote = createdAccounts > 0 ? ` Created ${createdAccounts} new account(s).` : '';
    setLastImportSummary(
      `Imported ${summary.imported}, skipped ${summary.skipped}, warnings ${summary.warnings.length}, errors ${summary.errors.length}.${createdNote}`
    );

    alertImportSummary(summary);

    const stats: CsvImportStats = {
      imported: summary.imported,
      skipped: summary.skipped,
      warnings: summary.warnings.length,
      errors: summary.errors.length,
      source: importSource ?? 'manual',
      mode: 'import',
      at: new Date().toISOString(),
      createdAccounts, // extra field (safe if your type allows; otherwise remove)
    } as any;

    setLastCsvStats(stats);
    try {
      await AsyncStorage.setItem(CSV_STATS_KEY, JSON.stringify(stats));
    } catch {
      // ignore
    }

    setLastStatus('CSV import complete. Review results above.');
  } catch (err: any) {
    console.error(err);
    Alert.alert('CSV import error', 'Something went wrong while importing the CSV.');
    setLastStatus(`CSV import error: ${String(err?.message ?? err)}`);
  }
};



  const handleParseCsvPress = () => {
    if (!importCsvText.trim()) {
      setLastStatus('Paste CSV text or pick a file first.');
      return;
    }

    try {
      const rows = parseCsvLines(importCsvText);

      if (!rows.length) {
        setLastStatus('CSV parsed but contains no rows.');
        setCsvPreview('');
        setCsvPreviewSourceName('');
        setLastImportSummary('');
        return;
      }

      const [firstRow, ...restRows] = rows;
      let dataRows = rows;
      let headerRow: string[] | null = null;

      if (csvHasHeaderRow) {
        headerRow = firstRow;
        dataRows = restRows;
      }

      let accountColIndex = -1;
      let categoryColIndex = -1;
      let amountColIndex = -1;
      let dateColIndex = -1;
      let descColIndex = -1;
      let merchantColIndex = -1;

      if (headerRow) {
        const headerLower = headerRow.map((h) => String(h).trim().toLowerCase());
        const findOneOf = (candidates: string[]) => headerLower.findIndex((h) => candidates.includes(h));

        dateColIndex = findOneOf(['date', 'txn_date', 'transaction_date', 'tx_date']);
        accountColIndex = findOneOf(['account', 'account_name', 'account name']);
        amountColIndex = findOneOf(['amount', 'value', 'amt']);
        descColIndex = findOneOf(['description', 'desc', 'details', 'note']);
        merchantColIndex = findOneOf(['merchant', 'payee', 'name']);
        categoryColIndex = findOneOf(['category', 'cat', 'category_name', 'category name']);
      }

      const maxPreviewRows = 5;
      const previewRows = dataRows.slice(0, maxPreviewRows);

      const previewLines: string[] = [];
      if (headerRow) previewLines.push('HEADER: ' + headerRow.join(' | '));
      else previewLines.push('No header row (First row is header = OFF)');

      previewLines.push('--- Sample rows ---');
      for (const row of previewRows) previewLines.push(row.join(' | '));
      if (dataRows.length > maxPreviewRows) previewLines.push(`…plus ${dataRows.length - maxPreviewRows} more rows`);

      setCsvPreview(previewLines.join('\n'));

      if (accountColIndex >= 0) {
        let matchedCount = 0;
        let unknownCount = 0;

        // Collect unique unknown accounts (preserve a “nice” display name)
        const unknownKeyToDisplay = new Map<string, string>();

        for (const row of dataRows) {
          if (accountColIndex >= row.length) continue;

          const raw = String(row[accountColIndex] ?? '');
          const displayName = raw.trim();
          if (!displayName) continue;

          const key = displayName.toLowerCase();

          if (knownAccountNames.has(key)) {
            matchedCount++;
          } else {
            unknownCount++;
            // store first-seen casing for display
            if (!unknownKeyToDisplay.has(key)) unknownKeyToDisplay.set(key, displayName);
          }
        }

        // Build preview text
        const bits: string[] = [];
        bits.push(
          `Detected account column at index ${accountColIndex}. Known: ${matchedCount}. Unknown: ${unknownCount}.`
        );
        bits.push(categoryColIndex >= 0 ? `Category col: ${categoryColIndex}.` : `No category column detected.`);
        bits.push(dateColIndex >= 0 ? `Date col: ${dateColIndex}.` : `No date col detected.`);
        bits.push(amountColIndex >= 0 ? `Amount col: ${amountColIndex}.` : `No amount col detected.`);
        bits.push(descColIndex >= 0 ? `Description col: ${descColIndex}.` : `No description col detected.`);
        bits.push(createMissingAccounts ? 'Unknown accounts will be created.' : 'Unknown accounts will be skipped.');

        // Add unknown account list (first 10)
        const unknownList = Array.from(unknownKeyToDisplay.values()).sort((a, b) => a.localeCompare(b));
        if (unknownList.length > 0) {
          const first10 = unknownList.slice(0, 10);
          bits.push(`Unknown accounts (unique): ${unknownList.length}.`);
          bits.push(`First ${first10.length}: ${first10.join(', ')}`);
          if (unknownList.length > first10.length) {
            bits.push(`…plus ${unknownList.length - first10.length} more`);
          }
        }

        setCsvPreviewSourceName(bits.join(' '));
      } else {
        setCsvPreviewSourceName(
          'No obvious account column detected in header. You can still import/restore, but rows must map correctly by column order.'
        );
      }


      setLastImportSummary('');
      setLastStatus('CSV parsed successfully. Review preview, then apply import or restore.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('CSV parse error', 'Something went wrong while parsing the CSV text.');
      setLastStatus(`CSV parse error: ${String(err?.message ?? err)}`);
      setCsvPreview('');
      setCsvPreviewSourceName('');
      setLastImportSummary('');
    }
  };

  const persistCsvStats = async (stats: CsvImportStats) => {
    try {
      setLastCsvStats(stats);
      await AsyncStorage.setItem(CSV_STATS_KEY, JSON.stringify(stats));
    } catch {
      // ignore
    }
  };

  /* ===========================
     Recurring rebuild (aligned with RecurringItem)
  =========================== */

  const addDaysISO = (isoDate: string, days: number) => {
    const d = new Date(isoDate + 'T00:00:00Z');
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const median = (nums: number[]) => {
    const a = [...nums].sort((x, y) => x - y);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  };

  const inferFrequencyFromDates = (sortedISODatesAsc: string[]): { freq: RecurringFrequency; nextDueDate: string } => {
    // Need at least 2 occurrences
    if (sortedISODatesAsc.length < 2) {
      const fallback: RecurringFrequency = 'monthly' as any;
      const last = sortedISODatesAsc[sortedISODatesAsc.length - 1] ?? new Date().toISOString().slice(0, 10);
      return { freq: fallback, nextDueDate: addDaysISO(last, 30) };
    }

    const diffs: number[] = [];
    for (let i = 1; i < sortedISODatesAsc.length; i++) {
      const a = new Date(sortedISODatesAsc[i - 1] + 'T00:00:00Z').getTime();
      const b = new Date(sortedISODatesAsc[i] + 'T00:00:00Z').getTime();
      const days = Math.round((b - a) / (1000 * 60 * 60 * 24));
      if (isFinite(days) && days > 0) diffs.push(days);
    }

    const last = sortedISODatesAsc[sortedISODatesAsc.length - 1] ?? new Date().toISOString().slice(0, 10);
    if (!diffs.length) {
      const fallback: RecurringFrequency = 'monthly' as any;
      return { freq: fallback, nextDueDate: addDaysISO(last, 30) };
    }

    const md = median(diffs);

    // Map median gap → frequency
    // Adjust these if your RecurringFrequency values differ.
    let freq: RecurringFrequency = 'monthly' as any;
    let addDays = 30;

    if (md >= 5 && md <= 9) {
      freq = 'weekly' as any;
      addDays = 7;
    } else if (md >= 12 && md <= 18) {
      freq = 'fortnightly' as any;
      addDays = 14;
    } else if (md >= 24 && md <= 40) {
      freq = 'monthly' as any;
      addDays = 30;
    } else if (md >= 70 && md <= 120) {
      freq = 'quarterly' as any;
      addDays = 90;
    } else if (md >= 320 && md <= 420) {
      freq = 'yearly' as any;
      addDays = 365;
    }

    return { freq, nextDueDate: addDaysISO(last, addDays) };
  };

  const buildRecurringFromTransactions = useCallback(
    (allTxs: Transaction[]): RecurringItem[] => {
      type Group = {
        key: string;
        accountId?: string;
        title: string;
        category?: string;
        description?: string;
        amount: number;
        type: 'income' | 'expense';
        datesAsc: string[];
      };

      const groups = new Map<string, Group>();

      for (const t of allTxs || []) {
        if (!t?.date) continue;

        const type = (t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : null) as
          | 'income'
          | 'expense'
          | null;
        if (!type) continue; // ignore transfers for recurring detection

        const merchantRaw = (t as any).name || (t as any).description || '';
        const title = String(merchantRaw).trim();
        if (!title) continue;

        const category = String((t as any).category ?? '').trim() || undefined;

        const amountPennies = Math.round(Math.abs(Number(t.amount ?? 0)) * 100);
        if (!isFinite(amountPennies) || amountPennies <= 0) continue;

        const accountId = t.accountId || undefined;
        const iso = String(t.date).slice(0, 10);

        const key = [
          accountId || '__no_account__',
          norm(title),
          amountPennies,
          norm(category || '__no_category__'),
          type,
        ].join('|');

        const g = groups.get(key);
        if (!g) {
          groups.set(key, {
            key,
            accountId,
            title,
            category,
            description: String((t as any).description ?? '').trim() || undefined,
            amount: amountPennies / 100,
            type,
            datesAsc: [iso],
          });
        } else {
          g.datesAsc.push(iso);
        }
      }

      const out: RecurringItem[] = [];

      for (const g of groups.values()) {
        // only keep true repeats
        if (g.datesAsc.length < 2) continue;

        const datesAsc = [...g.datesAsc].sort();
        const { freq, nextDueDate } = inferFrequencyFromDates(datesAsc);

        out.push({
          id: `rec_${g.key}`,
          title: g.title,
          active: true,
          nextDueDate,
          frequency: freq,
          amount: g.amount,
          type: g.type,
          category: g.category,
          description: g.description,
          accountId: g.accountId,
          isTransfer: false,
        });
      }

      // strongest first (most occurrences)
      out.sort((a, b) => {
        const ac = groups.get(
          [
            a.accountId || '__no_account__',
            norm(a.title),
            Math.round(Math.abs(Number(a.amount ?? 0)) * 100),
            norm(a.category || '__no_category__'),
            a.type,
          ].join('|')
        )?.datesAsc.length ?? 0;

        const bc = groups.get(
          [
            b.accountId || '__no_account__',
            norm(b.title),
            Math.round(Math.abs(Number(b.amount ?? 0)) * 100),
            norm(b.category || '__no_category__'),
            b.type,
          ].join('|')
        )?.datesAsc.length ?? 0;

        return bc - ac;
      });

      return out;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ===========================
     CSV IMPORT (append) + rebuild recurring
  =========================== */

  const handleApplyCsvImportPress = () => {
    if (!importCsvText.trim()) {
      setLastStatus('Paste CSV text or pick a file first.');
      return;
    }

    const cleanDescription = (s: unknown) => {
      let v = String(s ?? '').replace(/\u00A0/g, ' ').trim();
      if (!v) return '';

      v = v.replace(/\*[A-Z0-9]{3,}/gi, ' ');
      v = v.replace(/\b\d{3,}[-/]\d{2,}\b/g, ' ');
      v = v.replace(/\b\d{6,}\b/g, ' ');
      v = v.replace(/\s+/g, ' ').trim();

      return v;
    };

    const normalizeHeader = (h: unknown) =>
      String(h ?? '')
        .replace(/\u00A0/g, ' ')
        .trim()
        .toLowerCase();

    const parseTypeCell = (typeStrRaw: unknown): 'income' | 'expense' | 'transfer' | null => {
      const s = String(typeStrRaw ?? '').trim().toLowerCase();
      if (!s) return null;
      if (s === 'expense' || s === 'out' || s === 'debit') return 'expense';
      if (s === 'income' || s === 'in' || s === 'credit') return 'income';
      if (s === 'transfer') return 'transfer';
      return null;
    };

    const parseAmount = (raw: unknown): number | null => {
      const s = String(raw ?? '').trim();
      if (!s) return null;
      const cleaned = s.replace(/[£$\s]/g, '').replace(/,/g, '');
      const n = Number(cleaned);
      if (!isFinite(n) || isNaN(n)) return null;
      return n;
    };

    const makeTxnKey = (input: {
      accountId: string;
      dateISO: string;
      type: string;
      amountAbs: number;
      descClean: string;
    }) => {
      const amt = Number(input.amountAbs || 0).toFixed(2);
      return `${input.accountId}__${input.dateISO}__${input.type}__${amt}__${norm(input.descClean)}`;
    };

    Alert.alert(
      'Confirm CSV import',
      createMissingAccounts
        ? 'This will import new transactions. If an account name does not exist, a new account will be created. Continue?'
        : 'This will import new transactions only for existing accounts. Unknown accounts are skipped. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            try {
              const rows = parseCsvLines(importCsvText);
              if (!rows.length) {
                setLastStatus('CSV parsed but contains no rows.');
                return;
              }

              const [firstRow, ...restRows] = rows;
              let dataRows = rows;
              let headerRow: string[] | null = null;

              if (csvHasHeaderRow) {
                headerRow = firstRow;
                dataRows = restRows;
              }

              // template order: Date, Account, Amount, Description, Merchant, Category, Type
              let dateCol = 0;
              let accountCol = 1;
              let amountCol = 2;
              let descriptionCol = 3;
              let merchantCol = 4;
              let categoryCol = 5;
              let typeCol = 6;

              if (headerRow) {
                const headerLower = headerRow.map(normalizeHeader);
                const findIndex = (names: string[]) => headerLower.findIndex((h) => names.includes(h));

                const dateIdx = findIndex(['date', 'tx_date', 'txn_date']);
                const accIdx = findIndex(['account', 'account_name', 'account name']);
                const amountIdx = findIndex(['amount', 'value', 'amt']);
                const descIdx = findIndex(['description', 'desc', 'details', 'note']);
                const merchantIdx = findIndex(['merchant', 'payee', 'name']);
                const catIdx = findIndex(['category', 'cat', 'category_name', 'category name']);
                const typeIdx = findIndex(['type', 'txn_type', 'tx_type']);

                if (dateIdx >= 0) dateCol = dateIdx;
                if (accIdx >= 0) accountCol = accIdx;
                if (amountIdx >= 0) amountCol = amountIdx;
                if (descIdx >= 0) descriptionCol = descIdx;
                if (merchantIdx >= 0) merchantCol = merchantIdx;
                if (catIdx >= 0) categoryCol = catIdx;
                if (typeIdx >= 0) typeCol = typeIdx;
              }

              const safeCell = (row: string[], idx: number) =>
                idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';

              let importedCount = 0;
              let skippedUnknownAccount = 0;
              let skippedBadAmount = 0;
              let skippedMissingAccountName = 0;
              let createdAccountsCount = 0;
              let skippedCouldNotCreateAccount = 0;
              let skippedDuplicate = 0;

              const createdAccountByName: Record<string, Account> = {};

              // Existing transaction keys (de-dupe)
              const existingKeys = new Set<string>();
              for (const t of txs || []) {
                const accountId = String((t as any).accountId ?? '');
                const dateISO = String((t as any).date ?? '');
                const type = String((t as any).type ?? '');
                const amountAbs = Math.abs(Number((t as any).amount ?? 0));
                const descClean = cleanDescription((t as any).description ?? (t as any).name ?? '');
                if (!accountId || !dateISO || !type) continue;
                existingKeys.add(makeTxnKey({ accountId, dateISO, type, amountAbs, descClean }));
              }

              const newTxs: Transaction[] = [];

              for (const row of dataRows) {
                if (!row.length) continue;

                const dateStr = safeCell(row, dateCol);
                const typeStrRaw = safeCell(row, typeCol);
                const amountRaw = safeCell(row, amountCol);
                const rawDesc = safeCell(row, descriptionCol);
                const rawMerchant = safeCell(row, merchantCol);
                const category = safeCell(row, categoryCol);
                const rawAccountName = safeCell(row, accountCol);

                const accountKey = norm(rawAccountName);
                const accountName = String(rawAccountName).replace(/\u00A0/g, ' ').trim();
                const accountNameSafe = accountName || 'Imported Account';

                if (!accountName) {
                  skippedMissingAccountName++;
                  continue;
                }

                let accountForRow: Account | undefined =
                  createdAccountByName[accountKey] ??
                  accounts.find((a) => a?.name && norm(a.name) === accountKey);

                if (!accountForRow) {
                  if (!createMissingAccounts) {
                    skippedUnknownAccount++;
                    continue;
                  }

                  let created: Account | null = null;
                  try {
                    created = actions.addAccount({
                      name: accountNameSafe,
                      type: 'bank',
                      balance: 0,
                    });
                  } catch (err) {
                    console.error('Error creating account from CSV row', err);
                  }

                  if (!created?.id) {
                    skippedCouldNotCreateAccount++;
                    continue;
                  }

                  createdAccountsCount++;
                  createdAccountByName[accountKey] = created;
                  accountForRow = created;
                }

                const amountNum = parseAmount(amountRaw);
                if (amountNum === null) {
                  skippedBadAmount++;
                  continue;
                }

                const dateISO = normalizeDateToISODate(String(dateStr || ''));
                if (!dateISO) {
                  skippedBadAmount++;
                  continue;
                }

                let finalType: TransactionType;
                const typeFromCell = parseTypeCell(typeStrRaw);
                if (typeFromCell) finalType = typeFromCell;
                else if (amountNum < 0) finalType = 'expense';
                else if (amountNum > 0) finalType = 'income';
                else finalType = 'expense';

                const amountAbs = Math.abs(amountNum);
                const descClean = cleanDescription(rawDesc);
                const descFinal = String(rawDesc ?? '').replace(/\u00A0/g, ' ').trim();

                const key = makeTxnKey({
                  accountId: accountForRow.id,
                  dateISO,
                  type: String(finalType),
                  amountAbs,
                  descClean: descClean || descFinal,
                });

                if (existingKeys.has(key)) {
                  skippedDuplicate++;
                  continue;
                }
                existingKeys.add(key);

                const added = actions.addTransaction({
                  accountId: accountForRow.id,
                  amount: amountAbs,
                  type: finalType,
                  date: dateISO,
                  name: descClean || undefined,
                  description: descFinal || undefined,
                  merchant: rawMerchant || undefined,
                  category: category || undefined,
                } as any);

                if (added) newTxs.push(added);
                importedCount++;
              }

              // ✅ Build the final accounts list (include any created during this import)
              const accountsAfter = [...accounts];
              const existingIds = new Set(accountsAfter.map((a) => a.id));

              for (const a of Object.values(createdAccountByName)) {
                if (a?.id && !existingIds.has(a.id)) {
                  accountsAfter.push(a);
                  existingIds.add(a.id);
                }
              }


              // ✅ Persist transactions + recurring in one go
              const allTxsAfter = [...txs, ...newTxs];
              const nextRecurring = buildRecurringFromTransactions(allTxsAfter);

              actions.replaceAllData({
                accounts: accountsAfter,          // ✅ use accountsAfter
                transactions: allTxsAfter,
                recurring: nextRecurring,
                budgets,
              });


              const summaryLines: string[] = [];
              summaryLines.push(`Imported transactions: ${importedCount}`);
              summaryLines.push(`New accounts created from CSV: ${createdAccountsCount}`);
              summaryLines.push(`Skipped duplicates: ${skippedDuplicate}`);
              summaryLines.push(`Skipped unknown accounts: ${skippedUnknownAccount}`);
              summaryLines.push(`Skipped invalid amount/date: ${skippedBadAmount}`);
              summaryLines.push(`Skipped missing account name: ${skippedMissingAccountName}`);
              summaryLines.push(`Account creation failed: ${skippedCouldNotCreateAccount}`);
              summaryLines.push(`Recurring items generated: ${nextRecurring.length}`);

              setLastImportSummary(summaryLines.join('\n'));
              setLastStatus('CSV import completed. Recurring rebuilt.');

              await persistCsvStats({
                importedCount,
                createdAccountsCount,
                skippedDuplicate,
                skippedUnknownAccount,
                skippedBadAmount,
                skippedMissingAccountName,
                skippedCouldNotCreateAccount,
                finishedAt: new Date().toISOString(),
                source: importSource === 'file' ? 'file' : 'manual',
                operation: 'import',
              });
            } catch (err: any) {
              console.error(err);
              Alert.alert('Import error', 'Something went wrong during CSV import.');
              setLastStatus(`Import error: ${String(err?.message ?? err)}`);
            }
          },
        },
      ]
    );
  };

  /* ===========================
     CSV RESTORE (replace/merge) + rebuild recurring
  =========================== */

  const buildCsvTransactions = (csvText: string) => {
    const rows = parseCsvLines(csvText);
    if (!rows.length) throw new Error('CSV parsed but contains no rows.');

    const [firstRow, ...restRows] = rows;
    let dataRows = rows;
    let headerRow: string[] | null = null;

    if (csvHasHeaderRow) {
      headerRow = firstRow;
      dataRows = restRows;
    }

    // template order: Date, Account, Amount, Description, Merchant, Category, Type
    let dateCol = 0;
    let accountCol = 1;
    let amountCol = 2;
    let descriptionCol = 3;
    let merchantCol = 4;
    let categoryCol = 5;
    let typeCol = 6;

    if (headerRow) {
      const headerLower = headerRow.map((h) => String(h).trim().toLowerCase());
      const findIndex = (names: string[]) => headerLower.findIndex((h) => names.includes(h));

      const dateIdx = findIndex(['date', 'tx_date', 'txn_date']);
      const typeIdx = findIndex(['type', 'txn_type', 'tx_type']);
      const amountIdx = findIndex(['amount', 'value', 'amt']);
      const accIdx = findIndex(['account', 'account_name', 'account name']);
      const descIdx = findIndex(['description', 'desc', 'details', 'note']);
      const merchantIdx = findIndex(['merchant', 'payee', 'name']);
      const catIdx = findIndex(['category', 'cat', 'category_name', 'category name']);

      if (dateIdx >= 0) dateCol = dateIdx;
      if (accIdx >= 0) accountCol = accIdx;
      if (amountIdx >= 0) amountCol = amountIdx;
      if (typeIdx >= 0) typeCol = typeIdx;
      if (descIdx >= 0) descriptionCol = descIdx;
      if (merchantIdx >= 0) merchantCol = merchantIdx;
      if (catIdx >= 0) categoryCol = catIdx;
    }

    const safeCell = (row: string[], idx: number) =>
      idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';

    const accountByName: Record<string, Account> = {};
    for (const a of accounts) {
      if (a?.name) accountByName[String(a.name).trim()] = a;
    }

    const newAccounts: Account[] = [...accounts];
    const builtTxs: Transaction[] = [];

    let importedCount = 0;
    let skippedUnknownAccount = 0;
    let skippedBadAmount = 0;
    let skippedMissingAccountName = 0;
    let createdAccountsCount = 0;
    let skippedCouldNotCreateAccount = 0;

    for (const row of dataRows) {
      if (!row.length) continue;

      const rawDate = safeCell(row, dateCol);
      const rawType = safeCell(row, typeCol);
      const rawAmountStr = safeCell(row, amountCol);
      const accountName = safeCell(row, accountCol);
      const description = safeCell(row, descriptionCol);
      const merchant = safeCell(row, merchantCol);
      const category = safeCell(row, categoryCol);

      if (!accountName) {
        skippedMissingAccountName++;
        continue;
      }

      const amountNum = Number(String(rawAmountStr).replace(/[£$\s]/g, '').replace(/,/g, ''));
      if (!isFinite(amountNum) || isNaN(amountNum)) {
        skippedBadAmount++;
        continue;
      }

      let acct = accountByName[accountName];

      if (!acct) {
        if (!createMissingAccounts) {
          skippedUnknownAccount++;
          continue;
        }

        try {
          const created = actions.addAccount({
            name: accountName,
            type: 'bank',
            balance: 0,
          });

          if (!created?.id) {
            skippedCouldNotCreateAccount++;
            continue;
          }

          acct = created;
        } catch (e) {
          console.error('CSV restore: could not create account', e);
          skippedCouldNotCreateAccount++;
          continue;
        }

        accountByName[accountName] = acct;
        newAccounts.push(acct);
        createdAccountsCount++;
      }

      const finalType = normalizeType(rawType, amountNum);
      const amount = Math.abs(amountNum);
      const isoDate = normalizeDateToISODate(String(rawDate));

      builtTxs.push({
        id: makeId('tx'),
        accountId: acct.id,
        date: isoDate,
        type: finalType,
        amount,
        category: category || undefined,
        description: description || undefined,
        merchant: merchant || undefined,
        name: description ? norm(description) : undefined,
      } as any);

      importedCount++;
    }

    return {
      newAccounts,
      builtTxs,
      stats: {
        importedCount,
        createdAccountsCount,
        skippedUnknownAccount,
        skippedBadAmount,
        skippedMissingAccountName,
        skippedCouldNotCreateAccount,
      },
    };
  };

  const handleApplyCsvRestore = () => {
    if (!importCsvText.trim()) {
      setLastStatus('Pick a CSV file or paste CSV text first.');
      return;
    }

    const modeText = csvRestoreMode === 'replace' ? 'REPLACE' : 'MERGE';
    const warning =
      csvRestoreMode === 'replace'
        ? 'This will REPLACE ALL existing transactions with the CSV transactions.\n\nAccounts are kept (and missing accounts can be created).'
        : 'This will MERGE by APPENDING CSV transactions to your existing transactions.\n\nAccounts are kept (and missing accounts can be created).';

    Alert.alert('Confirm CSV restore', `${warning}\n\nMode: ${modeText}\nContinue?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: async () => {
          try {
            const built = buildCsvTransactions(importCsvText);

            const finalTxs = csvRestoreMode === 'replace' ? built.builtTxs : [...txs, ...built.builtTxs];

            const nextRecurring = buildRecurringFromTransactions(finalTxs);

            actions.replaceAllData({
              accounts: built.newAccounts,
              transactions: finalTxs,
              recurring: nextRecurring,
              budgets,
            });

            const summaryLines: string[] = [];
            summaryLines.push(
              csvRestoreMode === 'replace'
                ? 'CSV restore complete (transactions REPLACED).'
                : 'CSV merge complete (transactions APPENDED).'
            );
            summaryLines.push(`Imported transactions: ${built.stats.importedCount}`);
            summaryLines.push(`New accounts created: ${built.stats.createdAccountsCount}`);
            summaryLines.push(`Skipped unknown accounts: ${built.stats.skippedUnknownAccount}`);
            summaryLines.push(`Skipped invalid amount: ${built.stats.skippedBadAmount}`);
            summaryLines.push(`Skipped missing account name: ${built.stats.skippedMissingAccountName}`);
            summaryLines.push(`Account creation failed: ${built.stats.skippedCouldNotCreateAccount}`);
            summaryLines.push(`Recurring items generated: ${nextRecurring.length}`);

            setLastImportSummary(summaryLines.join('\n'));
            setLastStatus('CSV restore/merge completed. Recurring rebuilt.');

            await persistCsvStats({
              ...built.stats,
              finishedAt: new Date().toISOString(),
              source: importSource === 'file' ? 'file' : 'manual',
              operation: 'restore',
              mode: csvRestoreMode,
            });
          } catch (err: any) {
            console.error(err);
            setLastStatus(`CSV restore failed: ${String(err?.message ?? err)}`);
            Alert.alert('Restore failed', 'Could not restore from CSV.');
          }
        },
      },
    ]);
  };

  return (
  <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
    <Text style={styles.h1}>Data export &amp; import</Text>
    <Text style={styles.subtle}>
      Export JSON/CSV to Files, restore from a JSON backup, or import/restore transactions from CSV.
    </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current data snapshot</Text>
        <Text style={styles.statLine}>Accounts: {accounts.length}</Text>
        <Text style={styles.statLine}>Transactions: {txs.length}</Text>
        <Text style={styles.statLine}>Recurring: {recurring.length}</Text>
        <Text style={styles.statLine}>Budgets: {budgets.length}</Text>
      </View>

      {/* JSON BACKUP */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>JSON backup (export / restore)</Text>
        <Text style={styles.sectionText}>
          Export a full backup to Files and restore it later. Restore supports Replace or Merge.
        </Text>

        <Pressable style={styles.btnPrimary} onPress={handleExportJsonFile}>
          <Text style={styles.btnPrimaryText}>Export full backup as JSON (Files)</Text>
        </Pressable>

        <Pressable style={styles.btnSecondary} onPress={handlePickJsonBackup}>
          <Text style={styles.btnSecondaryText}>Select JSON backup to restore</Text>
        </Pressable>

        {jsonPreview ? (
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Restore mode</Text>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>
                {jsonRestoreMode === 'replace' ? 'Replace (full restore)' : 'Merge (add new only)'}
              </Text>
              <Switch
                value={jsonRestoreMode === 'replace'}
                onValueChange={(v) => setJsonRestoreMode(v ? 'replace' : 'merge')}
              />
            </View>

            <Text style={styles.hint}>
              Replace wipes current data first. Merge keeps current data and adds only new IDs.
            </Text>
          </View>
        ) : null}

        {jsonPreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>JSON preview</Text>
            <Text style={styles.previewMeta}>Exported: {jsonPreview.exportedAt}</Text>
            <Text style={styles.statLine}>Accounts: {jsonPreview.app.accounts.length}</Text>
            <Text style={styles.statLine}>Transactions: {jsonPreview.app.transactions.length}</Text>
            <Text style={styles.statLine}>Recurring: {jsonPreview.app.recurring.length}</Text>

            <Pressable style={styles.btnDestructive} onPress={handleApplyJsonRestore}>
              <Text style={styles.btnDestructiveText}>Apply JSON restore ({jsonRestoreMode})</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* CSV TEMPLATE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV Template</Text>
        <Text style={styles.sectionText}>
          Generate the official CSV template and export it to Files.
        </Text>

        <Pressable 
          style={[styles.btnSecondary, isTemplateGenerated && styles.btnSecondaryActive]} 
          onPress={handleGenerateCsvTemplate}
        >
          <Text style={[styles.btnSecondaryText, isTemplateGenerated && styles.btnSecondaryTextActive]}>
            {isTemplateGenerated ? '✓ Template Generated' : 'Generate CSV Template (text)'}
          </Text>
        </Pressable>

        {isTemplateGenerated && (
          <Text style={styles.statusHint}>Template generated. Ready to export.</Text>
        )}

        <Pressable 
          style={[styles.btnPrimary, !isTemplateGenerated && styles.btnPrimaryDisabled]} 
          onPress={handleExportCsvPreview}
          disabled={!isTemplateGenerated}
        >
          <Text style={[styles.btnPrimaryText, !isTemplateGenerated && styles.btnPrimaryTextDisabled]}>
            Export Template CSV (Files)
          </Text>
        </Pressable>

        {showCsvPreview && csvExportPreview ? (() => {
          const limited = limitLines(csvExportPreview, previewMaxLines);
          return (
            <View style={styles.textBox}>
              <Text style={styles.textBoxLabel}>
                {csvExportPreviewSourceName || 'CSV preview'} (showing up to {previewMaxLines} lines)
              </Text>
              <ScrollView style={styles.textBoxScroll}>
                <Text selectable style={styles.monoText}>{limited.text}</Text>
              </ScrollView>
              {limited.truncated ? (
                <Text style={styles.hint}>Preview truncated: {limited.total} total lines.</Text>
              ) : null}
            </View>
          );
        })() : null}
      </View>

      {/* EXPORT TRANSACTIONS */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Export Transactions</Text>
        <Text style={styles.sectionText}>
          Generate and export your transactions as CSV to Files.
        </Text>

        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>Transactions CSV export options</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Include description</Text>
            <Switch value={csvIncludeDescription} onValueChange={setCsvIncludeDescription} />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Use account name (vs accountId)</Text>
            <Switch value={csvIncludeAccountName} onValueChange={setCsvIncludeAccountName} />
          </View>
        </View>

        <Pressable 
          style={[styles.btnSecondary, isTransactionsCsvGenerated && styles.btnSecondaryActive]} 
          onPress={handleGenerateCsv}
        >
          <Text style={[styles.btnSecondaryText, isTransactionsCsvGenerated && styles.btnSecondaryTextActive]}>
            {isTransactionsCsvGenerated ? '✓ Transactions CSV Generated' : 'Generate Transactions CSV (text)'}
          </Text>
        </Pressable>

        {isTransactionsCsvGenerated && (
          <Text style={styles.statusHint}>Transactions CSV generated. Ready to export.</Text>
        )}

        <Pressable 
          style={[styles.btnPrimary, !isTransactionsCsvGenerated && styles.btnPrimaryDisabled]} 
          onPress={handleExportCsvFile}
          disabled={!isTransactionsCsvGenerated}
        >
          <Text style={[styles.btnPrimaryText, !isTransactionsCsvGenerated && styles.btnPrimaryTextDisabled]}>
            Export Transactions CSV (Files)
          </Text>
        </Pressable>

        {showCsvPreview && exportCsvText ? (() => {
          const limited = limitLines(exportCsvText, previewMaxLines);
          return (
            <View style={styles.textBox}>
              <Text style={styles.textBoxLabel}>
                Generated transactions CSV (showing up to {previewMaxLines} lines)
              </Text>
              <ScrollView style={styles.textBoxScroll}>
                <Text selectable style={styles.monoText}>{limited.text}</Text>
              </ScrollView>
              {limited.truncated ? (
                <Text style={styles.hint}>Preview truncated: {limited.total} total lines.</Text>
              ) : null}
            </View>
          );
        })() : null}
      </View>

      {/* CSV IMPORT + RESTORE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV import / restore</Text>
        <Text style={styles.sectionText}>
          Pick a CSV file or paste CSV text below. Preview it, then import (append) or restore (replace/merge).
        </Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>First row is header</Text>
          <Switch value={csvHasHeaderRow} onValueChange={setCsvHasHeaderRow} />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Create missing accounts from CSV</Text>
          <Switch value={createMissingAccounts} onValueChange={setCreateMissingAccounts} />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>
            CSV restore mode: {csvRestoreMode === 'replace' ? 'Replace' : 'Merge'}
          </Text>
          <Switch value={csvRestoreMode === 'merge'} onValueChange={(v) => setCsvRestoreMode(v ? 'merge' : 'replace')} />
        </View>

        <View style={styles.rowButtons}>
          <Pressable style={styles.btnSecondary} onPress={handlePickCsvFile}>
            <Text style={styles.btnSecondaryText}>Pick CSV file</Text>
          </Pressable>

          <Pressable style={styles.btnDestructive} onPress={handleApplyCsvRestore}>
            <Text style={styles.btnDestructiveText}>
              {csvRestoreMode === 'replace' ? 'Restore from CSV' : 'Merge CSV into data'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Show previews (capped)</Text>
          <Switch value={showCsvPreview} onValueChange={setShowCsvPreview} />
        </View>


        <Text style={{ height: 12 }} />

        <Text style={styles.textBoxLabel}>Or paste CSV text below.</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          multiline
          value={importCsvText}
          onChangeText={(text) => {
            setImportCsvText(text);
            setImportSource('manual');
          }}
          placeholder="Paste CSV text…"
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
          editable
        />

        <View style={styles.rowButtons}>
          <Pressable style={styles.btnSecondary} onPress={handleParseCsvPress}>
            <Text style={styles.btnSecondaryText}>Preview CSV</Text>
          </Pressable>

          <Pressable style={styles.btnDestructive} onPress={handleApplyCsvImportPress}>
            <Text style={styles.btnDestructiveText}>Apply CSV import</Text>
          </Pressable>
        </View>

        {showCsvPreview && csvPreview ? (() => {
          const limited = limitLines(csvPreview, previewMaxLines);
          return (
            <View style={styles.previewBox}>
              <Text style={styles.sectionTitle}>CSV preview (read-only)</Text>
              {csvPreviewSourceName ? <Text style={styles.previewMeta}>{csvPreviewSourceName}</Text> : null}

              <View style={styles.previewScroll}>
                <Text selectable style={styles.previewText}>
                  {limited.text}
                </Text>
              </View>

              {limited.truncated ? (
                <Text style={styles.hint}>
                  Preview truncated: {limited.total} total lines. Export/view the file to see everything.
                </Text>
              ) : null}
            </View>
          );
        })() : null}



        {lastCsvStats ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>
              Last CSV {lastCsvStats.operation === 'restore' ? 'restore' : 'import'} (persisted)
            </Text>
            <Text style={styles.statusText}>
              {new Date(lastCsvStats.finishedAt).toLocaleString()} ({lastCsvStats.source}
              {lastCsvStats.mode ? ` • ${lastCsvStats.mode}` : ''})
            </Text>
            <Text style={styles.statusText}>Imported: {lastCsvStats.importedCount}</Text>
            <Text style={styles.statusText}>Accounts created: {lastCsvStats.createdAccountsCount}</Text>
            <Text style={styles.statusText}>Skipped unknown: {lastCsvStats.skippedUnknownAccount}</Text>
            <Text style={styles.statusText}>Bad amount: {lastCsvStats.skippedBadAmount}</Text>
            <Text style={styles.statusText}>Missing account: {lastCsvStats.skippedMissingAccountName}</Text>
          </View>
        ) : null}

        {lastStatus ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusText}>{lastStatus}</Text>
          </View>
        ) : null}

        {lastImportSummary ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Summary</Text>
            <Text style={styles.statusText}>{lastImportSummary}</Text>
          </View>
        ) : null}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 32 },

  h1: { color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtle: { color: theme.textDim, marginBottom: 16 },

  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },

  sectionTitle: { color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  sectionText: { color: '#D1D5DB', marginBottom: 10 },

  statLine: { color: '#E5E7EB', marginTop: 2 },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(147, 197, 253, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.25)',
    marginBottom: 12,
  },
  pillText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },

  btnPrimary: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnPrimaryText: { color: 'white', fontWeight: '600', textAlign: 'center' },
  btnPrimaryDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  btnPrimaryTextDisabled: { color: '#9CA3AF' },

  btnSecondary: {
    flex: 1,
    marginTop: 8,
    marginRight: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  btnSecondaryText: { color: '#E5E7EB', fontWeight: '600', textAlign: 'center' },
  btnSecondaryActive: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  btnSecondaryTextActive: { color: '#93C5FD', fontWeight: '700' },

  btnDestructive: {
    flex: 1,
    marginTop: 8,
    marginLeft: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#B91C1C',
  },
  btnDestructiveText: { color: 'white', fontWeight: '600', textAlign: 'center' },

  rowButtons: { flexDirection: 'row', marginTop: 4 },

  optionsBox: {
    marginTop: 8,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: theme.cardAlt,
  },
  optionsTitle: { color: '#E5E7EB', fontWeight: '600', marginBottom: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  optionLabel: { color: '#D1D5DB', flex: 1, marginRight: 8 },

  textBox: { marginTop: 10, maxHeight: 260 },
  textBoxLabel: { color: theme.textDim, marginBottom: 4 },
  textBoxScroll: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#020617',
  },
  monoText: {
    color: '#E5E7EB',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
    fontSize: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#020617',
    color: '#E5E7EB',
    fontSize: 13,
  },
  inputMultiline: { minHeight: 140 },

  statusBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusLabel: { color: theme.textDim, fontWeight: '600', marginBottom: 2 },
  statusText: { color: '#E5E7EB' },

  previewBox: {
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: theme.border,
  },
  previewMeta: { color: theme.textDim, fontSize: 12, marginBottom: 8 },
  previewScroll: { maxHeight: 200 },
  previewText: {
    color: '#E5E7EB',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
  },

  hint: { color: theme.textDim, opacity: 0.7, marginTop: 6 },
  statusHint: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
});
