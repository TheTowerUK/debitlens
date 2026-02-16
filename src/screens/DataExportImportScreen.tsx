// src/screens/DataExportImportScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
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
import { CSV_TEMPLATE } from '../utils/csvTemplate';
import {
  buildHeaderMap,
  validateRequiredHeaders,
  type HeaderMap,
  type CanonicalCsvKey,
} from '../utils/csvImport';

const FS: any = FileSystem as any;
const norm = (s: string) => s.trim().toLowerCase();

// Yield helper for UI responsiveness
const yieldToUI = () => new Promise<void>((res) => setTimeout(res, 0));

const MAX_CSV_IMPORT_ROWS = 200;
const PENDING_IMPORT_KEY = 'debitlens:pendingCsvImport:v1';

function isExcelFilename(name?: string): boolean {
  const n = String(name || '').toLowerCase().trim();
  return n.endsWith('.xlsx') || n.endsWith('.xls');
}

// Account resolution helpers
const normName = (s: string) =>
  stripBom(s).replace(/\u00A0/g, ' ').trim().toLowerCase();

function resolveAccountId(
  accountCell: string,
  accounts: { id?: string; name?: string }[]
): string | null {
  const v = String(accountCell ?? '').replace(/\u00A0/g, ' ').trim();
  if (!v) return null;

  // exact ID match
  const byId = accounts.find((a) => a?.id === v);
  if (byId?.id) return byId.id;

  // name match (case-insensitive)
  const n = normName(v);
  const byName = accounts.find((a) => a?.name && normName(a.name) === n);
  if (byName?.id) return byName.id;

  return null;
}

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

type BackupPayload = {
  accounts?: any[];
  transactions?: any[];
  recurring?: any[];
};

function isArray(v: any): v is any[] {
  return Array.isArray(v);
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

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLowerCase();
}

function toIsoDateOnly(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = new Date(value as string | number);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function normalizeStoredAmount(amount: unknown): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n);
}

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

const stripBom = (s: string) => String(s ?? '').replace(/^\uFEFF/, '');

/** Treat literal "null" and "undefined" (case-insensitive) as empty string to avoid crashes. */
function normalizeCellValue(s: string): string {
  const raw = String(s ?? '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return '';
  return raw;
}

/** Normalize category for CSV import. Preserves exact string for unknown categories. */
function normalizeCategory(raw: string | undefined | null): string | undefined {
  const s = String(raw ?? '').replace(/\u00A0/g, ' ').trim();
  return s || undefined;
}

function cleanDescription(s: unknown) {
  let v = String(s ?? '').replace(/\u00A0/g, ' ').trim();
  if (!v) return '';

  v = v.replace(/\*[A-Z0-9]{3,}/gi, ' ');
  v = v.replace(/\b\d{3,}[-/]\d{2,}\b/g, ' ');
  v = v.replace(/\b\d{6,}\b/g, ' ');
  v = v.replace(/\s+/g, ' ').trim();

  return v;
}

function detectDelimiter(raw: string): ',' | ';' | '\t' {
  const firstLine = (stripBom(raw).split(/\r?\n/)[0] ?? '');
  const comma = (firstLine.match(/,/g) || []).length;
  const semi = (firstLine.match(/;/g) || []).length;
  const tab = (firstLine.match(/\t/g) || []).length;

  // choose the delimiter that appears most in the header line
  if (tab >= semi && tab >= comma) return '\t';
  if (semi >= comma) return ';';
  return ',';
}

function parseCsvLines(raw: string): string[][] {
  const cleaned = stripBom(raw);

  const delim = detectDelimiter(cleaned);

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => {
      if (!l) return false;
      // Ignore rows that are only delimiters (tabs / commas / semicolons)
      return l.replace(/[,\t;]+/g, '').trim().length > 0;
    });

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
      } else if (ch === delim && !inQuotes) {
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

function isExcelFile(name?: string, mimeType?: string): boolean {
  const n = String(name || '').toLowerCase();
  const m = String(mimeType || '').toLowerCase();
  return (
    n.endsWith('.xlsx') ||
    n.endsWith('.xls') ||
    m.includes('spreadsheetml') ||
    m.includes('ms-excel')
  );
}

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

  // Guard against Excel files
  if (isExcelFile(asset.name, asset.mimeType)) {
    Alert.alert(
      'Excel file selected',
      'DebitLens currently imports CSV, not .xlsx.\n\nOpen the file in Excel and use: File → Save As → CSV (Comma delimited).\nThen import the CSV.'
    );
    return null;
  }

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
  skippedBadAmountOrDate: number;
  skippedMissingAccountName: number;
  skippedCouldNotCreateAccount: number;
  skippedDuplicate?: number;
  skippedInvalidType?: number;
  skippedInvalidAccountForType?: number;
  skippedTransferMissingAccountB?: number;
  finishedAt: string; // ISO
  source: 'file' | 'manual';
  operation?: 'import' | 'restore';
  mode?: RestoreMode;
  batchOffset?: number;
  batchEnd?: number;
  totalRows?: number;
};

const CSV_STATS_KEY = 'debitlens:lastCsvImportStats:v1';

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

  const [showPreview, setShowPreview] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowPreview(false);
        setJsonPreview(null);
        setShowTemplatePreview(false);
        setShowExportPreview(false);
        setShowCsvPreview(false);
      };
    }, [])
  );

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
      setShowPreview(false);
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

          setShowPreview(false);
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
  const [templateCsvText] = useState<string>(CSV_TEMPLATE);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);

  const isTemplateGenerated = true;

  const isTransactionsCsvGenerated = useMemo(() => {
    return !!exportCsvText.trim();
  }, [exportCsvText]);

  const handleExportCsvPreview = async () => {
    try {
      const filename = 'DebitLens-CSV-Template.csv';
      await writeAndShareFile(filename, templateCsvText, 'text/csv');
      setLastStatus('CSV template exported to Files (via Share).');
      setShowTemplatePreview(false);
      setShowExportPreview(false);
      setShowCsvPreview(false);
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

      const amountStored = normalizeStoredAmount(t.amount);
      const amountOut =
        t.type === 'expense'
          ? -amountStored
          : amountStored;

      const typeCell =
        String(t.type).toLowerCase() === 'income'
          ? 'Income'
          : String(t.type).toLowerCase() === 'transfer'
            ? 'Transfer'
            : 'Expense';

      const row: (string | number)[] = [
        toIsoDateOnly(t.date),
        accountCell,
        amountOut,
        csvIncludeDescription ? ((t as any).description ?? (t as any).name ?? '') : '',
        (t as any).merchant ?? '',
        (t as any).category ?? '',
        typeCell,
      ];

      lines.push(row.map(csvEscape).join(','));
    }

    const csv = '\uFEFF' + (lines.join('\n') + '\n');
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
      setShowTemplatePreview(false);
      setShowExportPreview(false);
      setShowCsvPreview(false);
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

  const [lastImportSummary, setLastImportSummary] = useState<string>('');
  const [createMissingAccounts, setCreateMissingAccounts] = useState<boolean>(false);
  const [importSource, setImportSource] = useState<'manual' | 'file' | null>(null);

  const [csvRestoreMode, setCsvRestoreMode] = useState<RestoreMode>('merge');
  const [lastCsvStats, setLastCsvStats] = useState<CsvImportStats | null>(null);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  
  type RecurringRebuildMode = 'none' | 'importedOnly' | 'last18Months' | 'all';
  // Default to 'importedOnly' for better performance on slower devices
  const [recurringRebuildMode, setRecurringRebuildMode] = useState<RecurringRebuildMode>('importedOnly');

  // Import batching (hard cap 200 rows per run)
  const [importBatchOffset, setImportBatchOffset] = useState<number>(0);
  const [importLastFilename, setImportLastFilename] = useState<string>('');
  const [importTotalDataRows, setImportTotalDataRows] = useState<number>(0);
  const [importHasMoreBatches, setImportHasMoreBatches] = useState<boolean>(false);

  // Pending import buffer (accumulates batches until commit)
  const [pendingTxs, setPendingTxs] = useState<Transaction[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<Account[]>([]);
  const [pendingActive, setPendingActive] = useState<boolean>(false);

  // Refs for immediate access to pending state during async operations
  const pendingTxsRef = useRef<Transaction[]>([]);
  const pendingAccountsRef = useRef<Account[]>([]);

  // Sync refs with state
  useEffect(() => {
    pendingTxsRef.current = pendingTxs;
  }, [pendingTxs]);

  useEffect(() => {
    pendingAccountsRef.current = pendingAccounts;
  }, [pendingAccounts]);

  // Cache parsed CSV rows (parse once, reuse for all batches)
  const cachedParsedRowsRef = useRef<string[][] | null>(null);
  const cachedTotalRowsRef = useRef<number>(0);
  const cachedFilenameRef = useRef<string>('');
  const cachedHeaderMapRef = useRef<HeaderMap | null>(null);

  // De-dupe keys built ONCE per import (not per batch)
  const existingKeysRef = useRef<Set<string> | null>(null);

  // Progress indicator state
  type ProgressStage =
    | 'idle'
    | 'parsing'
    | 'validating'
    | 'building'
    | 'deduping'
    | 'recurring'
    | 'saving'
    | 'done'
    | 'error';

  type ProgressState = {
    active: boolean;
    stage: ProgressStage;
    message: string;
    startedAt: number; // Date.now()
    parsedRows?: number;
    toImport?: number;
    imported?: number;
    skipped?: number;
  };

  const [progress, setProgress] = useState<ProgressState>({
    active: false,
    stage: 'idle',
    message: '',
    startedAt: 0,
  });

  // Progress helpers
  const startProgress = useCallback((message: string) => {
    setProgress({
      active: true,
      stage: 'parsing',
      message,
      startedAt: Date.now(),
      parsedRows: 0,
      toImport: 0,
      imported: 0,
      skipped: 0,
    });
  }, []);

  const updateProgress = useCallback((patch: Partial<ProgressState>) => {
    setProgress((p) => ({ ...p, ...patch, active: true }));
  }, []);

  const finishProgress = useCallback((message: string) => {
    setProgress((p) => ({
      ...p,
      active: false,
      stage: 'done',
      message,
    }));
  }, []);

  const failProgress = useCallback((message: string) => {
    setProgress((p) => ({
      ...p,
      active: false,
      stage: 'error',
      message,
    }));
  }, []);

  // Live elapsed time tick
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    if (!progress.active) return;

    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [progress.active]);

  const progressElapsedSec = useMemo(() => {
    if (!progress.startedAt) return 0;
    const end = progress.active ? nowTick : Date.now();
    return Math.max(0, Math.floor((end - progress.startedAt) / 1000));
  }, [progress.startedAt, progress.active, nowTick]);

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

  // Persist pending import to AsyncStorage (for crash recovery)
  const persistPending = useCallback(async (payload: {
    pendingTxs: Transaction[];
    pendingAccounts: Account[];
    offset: number;
    total: number;
    filename: string;
  }) => {
    try {
      await AsyncStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
  }, []);

  const clearPending = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PENDING_IMPORT_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Restore pending import on screen load
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_IMPORT_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.pendingTxs) && Array.isArray(parsed.pendingAccounts)) {
          setPendingTxs(parsed.pendingTxs);
          setPendingAccounts(parsed.pendingAccounts);
          setPendingActive(true);
          setImportBatchOffset(parsed.offset ?? 0);
          setImportTotalDataRows(parsed.total ?? 0);
          setImportLastFilename(parsed.filename ?? '');
          setImportHasMoreBatches((parsed.offset ?? 0) < (parsed.total ?? 0)); // offset < total
          setLastStatus('Recovered a pending CSV import. You can continue or commit.');
        }
      } catch {
        // ignore parse errors
      }
    })();
  }, []);

  const handlePickCsvFile = async () => {
    try {
      const picked = await pickAndReadTextFile({
        types: ['text/csv', 'text/plain', 'public.comma-separated-values-text'],
        fallbackName: 'import.csv',
      });

      if (!picked) {
        setLastStatus('File selection cancelled.');
        return;
      }

      // Guard: users often try to import Excel (.xlsx). We only support CSV text import.
      if (isExcelFilename(picked.filename)) {
        Alert.alert(
          'Excel file selected',
          'DebitLens currently imports CSV files, not Excel (.xlsx).\n\nOpen the file in Excel and use:\nFile → Save As → CSV (Comma delimited)\n\nThen import the CSV.'
        );
        setLastStatus('Excel file selected. Please export to CSV and try again.');
        return;
      }

      if (!picked.text || !picked.text.trim()) {
        Alert.alert('Empty file', 'The selected file appears to be empty.');
        setLastStatus('Selected file is empty.');
        return;
      }

      // Clear any existing pending import when picking a new file
      setPendingTxs([]);
      setPendingAccounts([]);
      setPendingActive(false);
      existingKeysRef.current = null; // Clear de-dupe keys for new import
      await clearPending();

      setImportCsvText(picked.text);
      setImportSource('file');
      setLastImportSummary('');
      setImportBatchOffset(0);
      setImportLastFilename(picked.filename || '');
      setImportTotalDataRows(0);
      setImportHasMoreBatches(false);

      // Parse once and cache (so Continue doesn't re-parse)
      try {
        startProgress('Preparing CSV…');
        updateProgress({ stage: 'parsing', message: 'Parsing CSV…' });
        await yieldToUI();

        const rows = parseCsvLines(picked.text);
        if (!rows.length) throw new Error('CSV parsed but contains no rows.');

        const headerRow = (rows[0] ?? []).map((h) => String(h ?? ''));
        const headerMap = buildHeaderMap(headerRow);

        const missingMessage = validateRequiredHeaders(headerMap);
        if (missingMessage) {
          throw new Error(`Missing required columns: ${missingMessage}.`);
        }

        const getCell = (row: string[], key: CanonicalCsvKey) => {
          const idx = headerMap.indexByKey[key];
          const raw = idx !== undefined && typeof idx === 'number' ? stripBom(row[idx] ?? '') : '';
          return normalizeCellValue(raw);
        };

        const dataRows = rows.slice(1);

        // Filter out template instruction rows + empty rows (row has at least one non-empty cell)
        const filteredRows = dataRows.filter((r) => {
          const d = getCell(r, 'date');
          if (/yyyy-mm-dd/i.test(d)) return false;
          return (r || []).some((cell) => String(cell ?? '').trim().length > 0);
        });

        cachedParsedRowsRef.current = filteredRows;
        cachedTotalRowsRef.current = filteredRows.length;
        cachedFilenameRef.current = picked.filename || '';
        cachedHeaderMapRef.current = headerMap;

        setImportTotalDataRows(filteredRows.length);
        setImportHasMoreBatches(0 < filteredRows.length); // offset < total (no rows processed yet)

        finishProgress(`CSV ready: ${filteredRows.length} data rows.`);
        setLastStatus(`CSV ready: ${filteredRows.length} rows. Import will run in batches of ${MAX_CSV_IMPORT_ROWS}.`);
      } catch (e: any) {
        cachedParsedRowsRef.current = null;
        cachedTotalRowsRef.current = 0;
        cachedFilenameRef.current = '';
        cachedHeaderMapRef.current = null;
        failProgress(`CSV prep failed: ${e?.message ?? String(e)}`);
        Alert.alert('CSV error', e?.message ?? 'Could not parse CSV.');
        setLastStatus(`CSV error: ${e?.message ?? 'Could not parse CSV.'}`);
      }
    } catch (err: any) {
      console.error('Error picking CSV file:', err);
      const errorMsg = err?.message || String(err) || 'Unknown error';
      Alert.alert('File error', `Something went wrong while reading the CSV file:\n\n${errorMsg}`);
      setLastStatus(`File error: ${errorMsg}`);
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

  // Helper to filter transactions to recent window (for recurring rebuild performance)
  function filterTxsToLastMonths(all: Transaction[], monthsBack: number): Transaction[] {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return all.filter((t) => String(t.date || '').slice(0, 10) >= cutoffIso);
  }

  // Async chunked recurring rebuild (fast + safe)
  async function buildRecurringFromTransactionsChunked(opts: {
    txs: Transaction[];
    chunkSize?: number;
    onProgress?: (info: { phase: string; processed: number; total: number }) => void;
  }): Promise<RecurringItem[]> {
    const { txs, chunkSize = 800, onProgress } = opts;

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
    const total = txs.length;

    // Phase 1: build groups in chunks
    for (let i = 0; i < txs.length; i++) {
      const t = txs[i];
      if (!t?.date) continue;

      const type =
        t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : null;
      if (!type) continue; // ignore transfers

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

      if (i > 0 && i % chunkSize === 0) {
        onProgress?.({ phase: 'grouping', processed: i, total });
        await yieldToUI();
      }
    }

    onProgress?.({ phase: 'grouping', processed: total, total });
    await yieldToUI();

    // Phase 2: build recurring items from groups (also chunked)
    const groupValues = Array.from(groups.values());
    const out: RecurringItem[] = [];

    for (let i = 0; i < groupValues.length; i++) {
      const g = groupValues[i];
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
      });

      if (i > 0 && i % Math.max(200, Math.floor(chunkSize / 4)) === 0) {
        onProgress?.({ phase: 'building', processed: i, total: groupValues.length });
        await yieldToUI();
      }
    }

    onProgress?.({ phase: 'building', processed: groupValues.length, total: groupValues.length });
    await yieldToUI();

    // Phase 3: strongest-first sort (usually fine; yields once before/after)
    await yieldToUI();

    out.sort((a, b) => {
      const ac =
        groups.get(
          [
            a.accountId || '__no_account__',
            norm(a.title),
            Math.round(Math.abs(Number(a.amount ?? 0)) * 100),
            norm(a.category || '__no_category__'),
            a.type,
          ].join('|')
        )?.datesAsc.length ?? 0;

      const bc =
        groups.get(
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

    await yieldToUI();
    return out;
  }

  /* ===========================
     CSV IMPORT (append) + rebuild recurring
  =========================== */

  const runCsvImportBatch = useCallback(
    async (offset: number) => {
      const toIsoDate = (v: string) => {
        const s = (v || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          const dd = m[1].padStart(2, '0');
          const mm = m[2].padStart(2, '0');
          const yyyy = m[3];
          return `${yyyy}-${mm}-${dd}`;
        }
        return s;
      };
      const parseAmount = (v: string) => {
        const s = (v || '')
          .trim()
          .replace(/£/g, '')
          .replace(/,/g, '')
          .replace(/^\((.*)\)$/, '-$1');
        const n = Number(s);
        return Number.isFinite(n) ? n : NaN;
      };
      const normType = (v: string): 'income' | 'expense' | 'transfer' | null => {
        const s = (v || '').trim().toLowerCase();
        if (s === 'income') return 'income';
        if (s === 'expense') return 'expense';
        if (s === 'transfer') return 'transfer';
        return null;
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
      const makeTransferKey = (input: {
        fromAccountId: string;
        toAccountId: string;
        dateISO: string;
        amountAbs: number;
        descClean: string;
      }) => {
        const amt = Number(input.amountAbs || 0).toFixed(2);
        return `transfer__${input.fromAccountId}__${input.toAccountId}__${input.dateISO}__${amt}__${norm(input.descClean)}`;
      };

      try {
        startProgress('Starting CSV import…');
        await yieldToUI();

        // Only at start of new import (offset 0): clear dedupe keys. Never clear mid-continuation.
        if (offset === 0) {
          existingKeysRef.current = null;
        }

        // Use cached parsed rows (parsed once when file was picked)
        const cached = cachedParsedRowsRef.current;
        const total = cachedTotalRowsRef.current;

        if (!cached || !total) {
          Alert.alert('CSV not ready', 'Pick the CSV file again.');
          failProgress('CSV not ready. Please pick the file again.');
          setLastStatus('CSV not ready. Please pick the file again.');
          return;
        }

        // end = exclusive slice end = next offset for the following batch
        const end = Math.min(total, offset + MAX_CSV_IMPORT_ROWS);
        const batchRows = cached.slice(offset, end);

        if (!batchRows.length) {
          Alert.alert('Nothing to import', 'No remaining rows left to import.');
          failProgress('No remaining rows left to import.');
          setLastStatus('No remaining rows left to import.');
          return;
        }

        setLastStatus(`Importing rows ${offset + 1}-${end} of ${total} (batch ${MAX_CSV_IMPORT_ROWS})…`);

        updateProgress({
          stage: 'building',
          message: `Building transactions… (${offset + 1}-${end} of ${total})`,
          toImport: batchRows.length,
          parsedRows: total,
        });
        await yieldToUI();

        // Parse batch rows into transaction objects using cached headerMap
        const headerMap = cachedHeaderMapRef.current;
        if (!headerMap) {
          Alert.alert('CSV not ready', 'Pick the CSV file again.');
          failProgress('CSV header map missing. Please pick the file again.');
          setLastStatus('CSV header map missing. Please pick the file again.');
          return;
        }

        const getCell = (row: string[], key: CanonicalCsvKey) => {
          const idx = headerMap.indexByKey[key];
          const raw = idx !== undefined && typeof idx === 'number' ? stripBom(row[idx] ?? '') : '';
          return normalizeCellValue(raw);
        };

        const parsed = batchRows.map((r, rowIndex) => {
          const date = toIsoDate(getCell(r, 'date'));
          const accountA = getCell(r, 'accountA');
          const accountB = getCell(r, 'accountB');
          const amountNum = parseAmount(getCell(r, 'amount'));
          const amount = normalizeStoredAmount(amountNum);
          const description = getCell(r, 'description');
          const category = getCell(r, 'category');
          const type = normType(getCell(r, 'type'));
          const account = accountA || accountB;

          return {
            rowIndex: offset + rowIndex + 1,
            date,
            accountA,
            accountB,
            account,
            amount,
            description,
            category,
            type,
          };
        });

        // No early bad scan; validate per-row in the loop so stats reflect skips

        const limitedParsed = parsed;

              if (limitedParsed.length === 0) {
                Alert.alert('Nothing to import', 'No remaining rows left to import from this file.');
                failProgress('No remaining rows left to import.');
                setLastStatus('No remaining rows left to import.');
                return;
              }

              setLastStatus(`Importing rows ${offset + 1}-${end} of ${total} (max ${MAX_CSV_IMPORT_ROWS} per batch)…`);
              updateProgress({
                stage: 'building',
                message: `Building transactions… (${offset + 1}-${end} of ${total})`,
                toImport: limitedParsed.length,
                parsedRows: total,
              });
              await yieldToUI();

              let importedCount = 0;
              let skippedUnknownAccount = 0;
              let skippedBadAmountOrDate = 0;
              let skippedMissingAccountName = 0;
              let createdAccountsCount = 0;
              let skippedCouldNotCreateAccount = 0;
              let skippedDuplicate = 0;
              let skippedInvalidType = 0;
              let skippedInvalidAccountForType = 0;
              let skippedTransferMissingAccountB = 0;

              const createdAccountByName: Record<string, Account> = {};

              // Initialize existingKeysRef ONCE when starting a NEW import (offset === 0)
              if (offset === 0 || !existingKeysRef.current) {
                updateProgress({ stage: 'deduping', message: 'Checking for duplicates…' });
                await yieldToUI();

                const existingKeys = new Set<string>();
                // Build keys from current committed txs
                for (const t of txs || []) {
                  const dateISO = String((t as any).date ?? '');
                  const type = String((t as any).type ?? '');
                  const amountAbs = Math.abs(Number((t as any).amount ?? 0));
                  const descClean = cleanDescription((t as any).description ?? (t as any).name ?? '');
                  if (!dateISO || !type) continue;
                  
                  // Handle transfers differently (direction from fromAccountId/toAccountId)
                  if (type === 'transfer') {
                    const fromAccountId = String((t as any).fromAccountId ?? '');
                    const toAccountId = String((t as any).toAccountId ?? '');
                    if (!fromAccountId || !toAccountId) continue;
                    existingKeys.add(makeTransferKey({ fromAccountId, toAccountId, dateISO, amountAbs, descClean }));
                  } else {
                    // Regular income/expense transactions
                    const accountId = String((t as any).accountId ?? '');
                    if (!accountId) continue;
                    existingKeys.add(makeTxnKey({ accountId, dateISO, type, amountAbs, descClean }));
                  }
                }
                // Also include pending transactions from previous batches (if continuing an import)
                if (offset > 0 && pendingTxsRef.current.length > 0) {
                  for (const t of pendingTxsRef.current) {
                    const dateISO = String((t as any).date ?? '');
                    const type = String((t as any).type ?? '');
                    const amountAbs = Math.abs(Number((t as any).amount ?? 0));
                    const descClean = cleanDescription((t as any).description ?? (t as any).name ?? '');
                    if (!dateISO || !type) continue;
                    
                    // Handle transfers differently (direction from fromAccountId/toAccountId)
                    if (type === 'transfer') {
                      const fromAccountId = String((t as any).fromAccountId ?? '');
                      const toAccountId = String((t as any).toAccountId ?? '');
                      if (!fromAccountId || !toAccountId) continue;
                      existingKeys.add(makeTransferKey({ fromAccountId, toAccountId, dateISO, amountAbs, descClean }));
                    } else {
                      // Regular income/expense transactions
                      const accountId = String((t as any).accountId ?? '');
                      if (!accountId) continue;
                      existingKeys.add(makeTxnKey({ accountId, dateISO, type, amountAbs, descClean }));
                    }
                  }
                }
                existingKeysRef.current = existingKeys;
              }

              // Use the ref (shared across batches)
              const existingKeys = existingKeysRef.current!;

              updateProgress({ stage: 'building', message: `Building transactions…` });
              await yieldToUI();

              const newTxs: Transaction[] = [];
              const yieldEvery = 50; // Yield every 50 rows to avoid watchdog kills
              let processed = 0;

              // Get all available accounts (existing + pending)
              const allAvailableAccounts = [...accounts, ...pendingAccountsRef.current];
              const allAccountIds = new Set(allAvailableAccounts.map((a) => a.id));

              for (let i = 0; i < limitedParsed.length; i++) {
                const p = limitedParsed[i];
                processed++;

                // Skip rows with unknown Type (normalize: income|expense|transfer only)
                if (p.type === null || p.type === undefined) {
                  skippedInvalidType++;
                  continue;
                }

                // Row-level validation: require correct account column(s) for Type
                const accountATrim = String(p.accountA ?? '').replace(/\u00A0/g, ' ').trim();
                const accountBTrim = String(p.accountB ?? '').replace(/\u00A0/g, ' ').trim();
                if (p.type === 'expense' && !accountATrim) {
                  skippedInvalidAccountForType++;
                  continue;
                }
                if (p.type === 'income' && !accountBTrim) {
                  skippedInvalidAccountForType++;
                  continue;
                }
                if (p.type === 'transfer') {
                  if (!accountATrim) {
                    skippedInvalidAccountForType++;
                    continue;
                  }
                  if (!accountBTrim) {
                    skippedTransferMissingAccountB++;
                    continue;
                  }
                }

                // Type already normalized
                const isTransfer = p.type === 'transfer';

                // Primary account for this row: expense = Account A, income = Account B
                const accountName = isTransfer ? accountATrim : (p.type === 'expense' ? accountATrim : accountBTrim);
                const accountNameSafe = accountName || 'Imported Account';

                if (!accountName && !isTransfer) {
                  skippedMissingAccountName++;
                  continue;
                }

                let accountForRow: Account | undefined = null;

                if (!isTransfer) {
                  const accountsForLookup = [...allAvailableAccounts, ...Object.values(createdAccountByName)];
                  const resolvedAccountId = resolveAccountId(accountName, accountsForLookup);
                  if (resolvedAccountId) {
                    accountForRow = accountsForLookup.find((a) => a?.id === resolvedAccountId) ?? undefined;
                  }
                  if (!accountForRow) {
                    const accountKey = normName(accountName);
                    accountForRow = createdAccountByName[accountKey];
                    if (!accountForRow) {
                      if (!createMissingAccounts) {
                        skippedUnknownAccount++;
                        continue;
                      }
                      const newAccountId = makeId('acct');
                      const created: Account = {
                        id: newAccountId,
                        name: accountNameSafe,
                        type: 'bank',
                        balance: 0,
                      };
                      createdAccountsCount++;
                      createdAccountByName[accountKey] = created;
                      accountForRow = created;
                    }
                  }
                }

                // Amount: validate in loop
                const amountNum = p.amount;
                if (!Number.isFinite(amountNum)) {
                  skippedBadAmountOrDate++;
                  continue;
                }

                // Date: validate in loop (reject invalid or non-ISO shape)
                const dateISO = normalizeDateToISODate(p.date);
                if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
                  skippedBadAmountOrDate++;
                  continue;
                }

                // Transfer: fromAccountId = Account A, toAccountId = Account B, amount always positive
                if (isTransfer) {
                  const amountAbs = normalizeStoredAmount(amountNum);

                  const getOrCreateAccount = (name: string): Account | null => {
                    const list = [...allAvailableAccounts, ...Object.values(createdAccountByName)];
                    const resolvedId = resolveAccountId(name, list);
                    let acc = resolvedId ? list.find((a) => a?.id === resolvedId) : null;
                    if (!acc) {
                      const key = normName(name);
                      acc = createdAccountByName[key];
                    }
                    if (!acc && createMissingAccounts) {
                      const newId = makeId('acct');
                      acc = {
                        id: newId,
                        name: name || 'Imported Account',
                        type: 'bank',
                        balance: 0,
                      };
                      createdAccountsCount++;
                      createdAccountByName[normName(name)] = acc;
                    }
                    return acc ?? null;
                  };

                  const accountAObj = getOrCreateAccount(accountATrim);
                  const accountBObj = getOrCreateAccount(accountBTrim);
                  if (!accountAObj?.id || !accountBObj?.id) {
                    skippedUnknownAccount++;
                    continue;
                  }

                  const fromAccountId = accountAObj.id;
                  const toAccountId = accountBObj.id;

                  const descFinal = String(p.description ?? '').replace(/\u00A0/g, ' ').trim();
                  const descClean = cleanDescription(descFinal);

                  const transferKey = makeTransferKey({
                    fromAccountId,
                    toAccountId,
                    dateISO,
                    amountAbs,
                    descClean,
                  });

                  if (existingKeys.has(transferKey)) {
                    skippedDuplicate++;
                    continue;
                  }
                  existingKeys.add(transferKey);

                  const newTxn: Transaction = {
                    id: makeId('tx'),
                    accountId: fromAccountId, // primary display account = Account A (from)
                    amount: amountAbs,
                    type: 'transfer',
                    date: dateISO,
                    description: descFinal || undefined,
                    category: normalizeCategory(p.category) ?? undefined,
                    merchant: accountBObj?.name ?? undefined, // UI display: other-side account name
                    fromAccountId,
                    toAccountId,
                  };

                  newTxs.push(newTxn);
                  importedCount++;
                  continue;
                }

                // Non-transfer: Income or Expense — require resolved account
                if (!accountForRow?.id) {
                  skippedUnknownAccount++;
                  continue;
                }

                let finalType: 'income' | 'expense';
                if (p.type === 'income') {
                  finalType = 'income';
                } else if (p.type === 'expense') {
                  finalType = 'expense';
                } else {
                  // Should not happen because we skip invalid types earlier,
                  // but keep a safe default.
                  finalType = 'expense';
                }

                const amountAbs = normalizeStoredAmount(amountNum);
                const descFinal = String(p.description ?? '').replace(/\u00A0/g, ' ').trim();
                const descClean = cleanDescription(descFinal);

                // Dedupe key: always use cleaned description for consistency
                const key = makeTxnKey({
                  accountId: accountForRow.id,
                  dateISO,
                  type: String(finalType),
                  amountAbs,
                  descClean, // always cleaned
                });

                if (existingKeys.has(key)) {
                  skippedDuplicate++;
                  continue;
                }
                existingKeys.add(key);

                const categoryFinal = normalizeCategory(p.category);

                // Build transaction object directly (don't call addTransaction to avoid state conflicts)
                const newTxn: Transaction = {
                  id: makeId('tx'),
                  accountId: accountForRow.id,
                  amount: amountAbs,
                  type: finalType,
                  date: dateISO,
                  name: descClean || undefined,
                  description: descFinal || undefined,
                  category: categoryFinal,
                };

                newTxs.push(newTxn);
                importedCount++;

                // Yield frequently to avoid watchdog kills (every 50 rows)
                if (processed % yieldEvery === 0) {
                  const totalSkipped =
                    skippedUnknownAccount +
                    skippedBadAmountOrDate +
                    skippedMissingAccountName +
                    skippedCouldNotCreateAccount +
                    skippedDuplicate +
                    skippedInvalidType +
                    skippedInvalidAccountForType +
                    skippedTransferMissingAccountB;
                  updateProgress({
                    imported: importedCount,
                    skipped: totalSkipped,
                    message: `Building transactions… (${offset + processed}/${total})`,
                  });
                  await yieldToUI();
                }
              }

              // ✅ Build the final accounts list (include any created during this batch)
              // Start with existing accounts + pending accounts from previous batches
              const accountsAfter = [...accounts, ...pendingAccountsRef.current];
              const existingIds = new Set(accountsAfter.map((a) => a.id));

              // Add newly created accounts from this batch
              for (const a of Object.values(createdAccountByName)) {
                if (a?.id && !existingIds.has(a.id)) {
                  accountsAfter.push(a);
                  existingIds.add(a.id);
                }
              }

              // Final progress update after loop
              const totalSkipped =
                skippedUnknownAccount +
                skippedBadAmountOrDate +
                skippedMissingAccountName +
                skippedCouldNotCreateAccount +
                skippedDuplicate +
                skippedInvalidType +
                skippedInvalidAccountForType +
                skippedTransferMissingAccountB;
              updateProgress({
                imported: importedCount,
                skipped: totalSkipped,
                message: `Built ${importedCount} transactions, ${totalSkipped} skipped`,
              });
              await yieldToUI();

              // ✅ Add to pending buffer instead of persisting immediately
              setPendingActive(true);

              // Merge accounts into pendingAccounts (dedupe by id)
              setPendingAccounts((prev) => {
                const map = new Map(prev.map((a) => [a.id, a]));
                // Include existing accounts when pending starts
                for (const a of accounts) map.set(a.id, a);
                // Add newly created accounts
                for (const a of accountsAfter) map.set(a.id, a);
                return Array.from(map.values());
              });

              // Append transactions into pendingTxs
              setPendingTxs((prev) => [...prev, ...newTxs]);

              setImportBatchOffset(end);
              setImportHasMoreBatches(end < total); // offset < total after this batch

              // Persist pending snapshot (for crash recovery)
              // Include prior pendingTxsRef.current + new transactions
              const currentPendingTxs = [...pendingTxsRef.current, ...newTxs];
              // Include prior pendingAccountsRef.current + newly created accounts
              const currentPendingAccounts = Array.from(
                new Map([
                  ...pendingAccountsRef.current.map((a) => [a.id, a] as const),
                  ...accounts.map((a) => [a.id, a] as const), // existing accounts
                  ...Object.values(createdAccountByName).map((a) => [a.id, a] as const), // newly created
                ]).values()
              );
              await persistPending({
                pendingTxs: currentPendingTxs,
                pendingAccounts: currentPendingAccounts,
                offset: end,
                total,
                filename: importLastFilename,
              });

              const summaryLines: string[] = [];
              summaryLines.push(`Batch imported: rows ${offset + 1}-${end} of ${total}`);
              summaryLines.push(`Remaining after batch: ${Math.max(0, total - end)}`);
              summaryLines.push(`Imported transactions: ${importedCount}`);
              summaryLines.push(`New accounts created from CSV: ${createdAccountsCount}`);
              summaryLines.push(`Skipped duplicates: ${skippedDuplicate}`);
              summaryLines.push(`Skipped unknown accounts: ${skippedUnknownAccount}`);
              summaryLines.push(`Skipped invalid amount/date: ${skippedBadAmountOrDate}`);
              summaryLines.push(`Skipped missing account name: ${skippedMissingAccountName}`);
              summaryLines.push(`Skipped unknown Type: ${skippedInvalidType}`);
              summaryLines.push(`Skipped wrong account for Type (expense=A, income=B, transfer=A+B): ${skippedInvalidAccountForType}`);
              if (skippedTransferMissingAccountB > 0) {
                summaryLines.push(`Transfer rows missing Account B (to-account) skipped: ${skippedTransferMissingAccountB}`);
              }
              summaryLines.push(`Account creation failed: ${skippedCouldNotCreateAccount}`);
              if (end >= total) {
                summaryLines.push(`All batches complete. Press "Commit import" to save to app.`);
              } else {
                summaryLines.push(`Pending in buffer. Use "Continue import" for next batch, then "Commit import" to save.`);
              }

              setLastImportSummary(summaryLines.join('\n'));
              if (end >= total) {
                setLastStatus(`CSV import complete. All ${total} rows in pending buffer. Press "Commit import" to save to app.`);
              } else {
                setLastStatus(`CSV import batch complete. Rows ${offset + 1}-${end} of ${total} in pending buffer. Use "Continue import" for next batch.`);
              }
              setShowTemplatePreview(false);
              setShowExportPreview(false);
              setShowCsvPreview(false);

              await persistCsvStats({
                importedCount,
                createdAccountsCount,
                skippedDuplicate,
                skippedUnknownAccount,
                skippedBadAmountOrDate,
                skippedMissingAccountName,
                skippedCouldNotCreateAccount,
                finishedAt: new Date().toISOString(),
                source: importSource === 'file' ? 'file' : 'manual',
                operation: 'import',
                batchOffset: offset,
                batchEnd: end,
                totalRows: total,
              });

              finishProgress(`Import complete: ${importedCount} imported (rows ${offset + 1}-${end} of ${total}).`);
      } catch (err: any) {
        console.error('CSV import error:', err);
        const errorMsg = err?.message || String(err) || 'Unknown error';
        failProgress(`Import failed: ${errorMsg}`);
        Alert.alert('Import error', `Something went wrong during CSV import:\n\n${errorMsg}`);
        setLastStatus(`Import error: ${errorMsg}`);
      }
    },
    [
      accounts,
      txs,
      recurring,
      budgets,
      actions,
      updateProgress,
      startProgress,
      finishProgress,
      failProgress,
      persistCsvStats,
      createMissingAccounts,
      importSource,
      persistPending,
      importLastFilename,
    ]
  );

  const handleApplyCsvImportPress = () => {
    if (!importCsvText || !importCsvText.trim()) {
      Alert.alert('No CSV data', 'Pick a CSV file first.');
      setLastStatus('Pick a CSV file first.');
      return;
    }
    if (progress.active) {
      Alert.alert('Import in progress', 'Please wait for the current import to complete.');
      return;
    }
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
            // Clear any existing pending import when starting a new one
            setPendingTxs([]);
            setPendingAccounts([]);
            setPendingActive(false);
            existingKeysRef.current = null; // Clear de-dupe keys for new import
            await clearPending();
            setImportBatchOffset(0);
            await runCsvImportBatch(0);
          },
        },
      ]
    );
  };

  const handleContinueCsvImportPress = () => {
    if (!importCsvText.trim()) {
      Alert.alert('No CSV loaded', 'Pick a CSV file first.');
      return;
    }
    if (!importHasMoreBatches) {
      Alert.alert('No more rows', 'There are no remaining rows to import.');
      return;
    }
    Alert.alert(
      'Continue CSV import',
      `This will import the next ${MAX_CSV_IMPORT_ROWS} rows from the currently loaded file.\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            await runCsvImportBatch(importBatchOffset);
          },
        },
      ]
    );
  };

  const handleCommitPendingImport = useCallback(async () => {
    if (!pendingActive || (!pendingTxs.length && !pendingAccounts.length)) {
      Alert.alert('Nothing to commit', 'No pending imported data found.');
      return;
    }

    // Capture values at alert time for consistency
    const txsToCommit = pendingTxs.length;
    const accountsToCommit = pendingAccounts.length;

    Alert.alert(
      'Commit imported data',
      `This will add ${txsToCommit} transactions to your app and save them.\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Commit',
          style: 'destructive',
          onPress: async () => {
            try {
              // Capture current pending state at commit time
              const currentPendingTxs = pendingTxsRef.current;
              const currentPendingAccounts = pendingAccountsRef.current;

              if (!currentPendingTxs.length && !currentPendingAccounts.length) {
                Alert.alert('Nothing to commit', 'Pending data was cleared.');
                return;
              }

              startProgress('Committing import…');
              updateProgress({ stage: 'saving', message: 'Saving imported data…' });
              await yieldToUI();

              const finalAccounts = currentPendingAccounts.length ? currentPendingAccounts : accounts;
              const finalTxs = [...txs, ...currentPendingTxs];

              // Rebuild recurring ONLY ONCE here (chunked) - default to last18Months only
              // User can rebuild manually with "Rebuild recurring now" button if needed
              updateProgress({ stage: 'saving', message: 'Finalizing commit…' });
              await yieldToUI();

              // Default to 'none' for commit - user can rebuild manually if needed
              // This avoids heavy recurring rebuild during commit which can cause hangs
              const nextRecurring = recurring; // Keep existing recurring, user can rebuild manually

              updateProgress({ stage: 'saving', message: 'Final save…' });
              await yieldToUI();

              actions.replaceAllData({
                accounts: finalAccounts,
                transactions: finalTxs,
                recurring: nextRecurring,
                budgets,
              });

              setPendingTxs([]);
              setPendingAccounts([]);
              setPendingActive(false);
              existingKeysRef.current = null; // Clear de-dupe keys after commit
              await clearPending();

              finishProgress('Import committed successfully.');
              setLastStatus(`Committed ${currentPendingTxs.length} imported transactions. Recurring items kept as-is. Use "Rebuild recurring now" if needed.`);
            } catch (e: any) {
              failProgress(e?.message ?? String(e));
              Alert.alert('Commit failed', e?.message ?? 'Unknown error');
            }
          },
        },
      ]
    );
  }, [pendingActive, pendingTxs, pendingAccounts, accounts, txs, actions, budgets, startProgress, updateProgress, finishProgress, failProgress, clearPending]);

  /* ===========================
     CSV RESTORE (replace/merge) + rebuild recurring
  =========================== */

  const buildCsvTransactions = (csvText: string) => {
    const rows = parseCsvLines(csvText);
    if (!rows.length) throw new Error('CSV parsed but contains no rows.');

    // Excel-friendly normalizers
    const toIsoDate = (v: string) => {
      const s = (v || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO

      // Accept DD/MM/YYYY (Excel format)
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
      }

      return s; // let validation handle anything else
    };

    const parseAmount = (v: string) => {
      const s = (v || '')
        .trim()
        .replace(/£/g, '')
        .replace(/,/g, '') // 1,234.56
        .replace(/^\((.*)\)$/, '-$1'); // (12.34)
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };

    const normType = (v: string): 'income' | 'expense' | 'transfer' | null => {
      const s = (v || '').trim().toLowerCase();
      if (s === 'income') return 'income';
      if (s === 'expense') return 'expense';
      if (s === 'transfer') return 'transfer';
      return null;
    };

    const headerRow = (rows[0] ?? []).map((h) => String(h ?? ''));
    const headerMap = buildHeaderMap(headerRow);

    const missingMessage = validateRequiredHeaders(headerMap);
    if (missingMessage) {
      throw new Error(`Missing required columns: ${missingMessage}.`);
    }

    const getCell = (row: string[], key: CanonicalCsvKey) => {
      const idx = headerMap.indexByKey[key];
      const raw = idx !== undefined && typeof idx === 'number' ? stripBom(row[idx] ?? '') : '';
      return normalizeCellValue(raw);
    };

    const dataRows = rows.slice(1);
    const filteredRows = dataRows.filter((r) => {
      const d = getCell(r, 'date');
      if (/yyyy-mm-dd/i.test(d)) return false;
      return (r || []).some((cell) => String(cell ?? '').trim().length > 0);
    });

    if (!filteredRows.length) {
      throw new Error('CSV contains only the header/instruction row.');
    }

    const newAccounts: Account[] = [...accounts];
    const builtTxs: Transaction[] = [];
    const createdAccountByName: Record<string, Account> = {};

    let importedCount = 0;
    let skippedUnknownAccount = 0;
    let skippedBadAmountOrDate = 0;
    let skippedMissingAccountName = 0;
    let skippedInvalidType = 0;
    let skippedInvalidAccountForType = 0;
    let skippedTransferMissingAccountB = 0;
    let createdAccountsCount = 0;
    let skippedCouldNotCreateAccount = 0;

    const parsed = filteredRows.map((r, rowIndex) => {
      const date = toIsoDate(getCell(r, 'date'));
      const accountA = getCell(r, 'accountA');
      const accountB = getCell(r, 'accountB');
      const amount = parseAmount(getCell(r, 'amount'));
      const description = getCell(r, 'description');
      const category = getCell(r, 'category');
      const type = normType(getCell(r, 'type'));
      const account = accountA || accountB;

      return {
        rowIndex: rowIndex + 2,
        date,
        accountA,
        accountB,
        account,
        amount,
        description,
        category,
        type,
      };
    });

    // No early bad scan; validate per-row in the loop so stats reflect skips

    for (const p of parsed) {
      if (p.type === null || p.type === undefined) {
        skippedInvalidType++;
        continue;
      }

      const accountATrim = String(p.accountA ?? '').replace(/\u00A0/g, ' ').trim();
      const accountBTrim = String(p.accountB ?? '').replace(/\u00A0/g, ' ').trim();
      if (p.type === 'expense' && !accountATrim) {
        skippedInvalidAccountForType++;
        continue;
      }
      if (p.type === 'income' && !accountBTrim) {
        skippedInvalidAccountForType++;
        continue;
      }
      if (p.type === 'transfer') {
        if (!accountATrim) {
          skippedInvalidAccountForType++;
          continue;
        }
        if (!accountBTrim) {
          skippedTransferMissingAccountB++;
          continue;
        }
      }

      const accountName = p.type === 'expense' ? accountATrim : p.type === 'income' ? accountBTrim : accountATrim;
      const accountNameSafe = accountName || 'Imported Account';

      if (!accountName && p.type !== 'transfer') {
        skippedMissingAccountName++;
        continue;
      }

      const amountNum = p.amount;
      if (!Number.isFinite(amountNum)) {
        skippedBadAmountOrDate++;
        continue;
      }

      const amount = normalizeStoredAmount(amountNum);
      const isoDate = normalizeDateToISODate(p.date);
      if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        skippedBadAmountOrDate++;
        continue;
      }

      const descFinal = String(p.description ?? '').replace(/\u00A0/g, ' ').trim();
      const descClean = cleanDescription(descFinal);
      const categoryFinal = normalizeCategory(p.category);

      if (p.type === 'transfer') {
        const getOrCreate = (name: string): Account | null => {
          const resolvedId = resolveAccountId(name, newAccounts);
          let acc = resolvedId ? newAccounts.find((a) => a?.id === resolvedId) ?? null : null;
          if (!acc) acc = createdAccountByName[normName(name)] ?? null;
          if (!acc && createMissingAccounts) {
            try {
              const created = actions.addAccount({
                name: name || 'Imported Account',
                type: 'bank',
                balance: 0,
              });
              if (created?.id) {
                acc = created;
                createdAccountByName[normName(name)] = acc;
                newAccounts.push(acc);
                createdAccountsCount++;
              }
            } catch {
              return null;
            }
          }
          return acc ?? null;
        };
        const acctA = getOrCreate(accountATrim);
        const acctB = getOrCreate(accountBTrim);
        if (!acctA || !acctB) {
          skippedUnknownAccount++;
          continue;
        }
        builtTxs.push({
          id: makeId('tx'),
          accountId: acctA.id,
          amount,
          type: 'transfer',
          date: isoDate,
          description: descFinal || undefined,
          name: descClean || undefined,
          category: categoryFinal,
          fromAccountId: acctA.id,
          toAccountId: acctB.id,
          merchant: acctB.name,
        } as any);
        importedCount++;
        continue;
      }

      let acct: Account | undefined = null;
      const resolvedAccountId = resolveAccountId(accountName, newAccounts);
      if (resolvedAccountId) {
        acct = newAccounts.find((a) => a?.id === resolvedAccountId) ?? null;
      }
      if (!acct) {
        const accountKey = normName(accountName);
        acct = createdAccountByName[accountKey] ?? null;
        if (!acct && createMissingAccounts) {
          try {
            const created = actions.addAccount({
              name: accountNameSafe,
              type: 'bank',
              balance: 0,
            });
            if (created?.id) {
              acct = created;
              createdAccountByName[accountKey] = acct;
              newAccounts.push(acct);
              createdAccountsCount++;
            }
          } catch (e) {
            console.error('CSV restore: could not create account', e);
            skippedCouldNotCreateAccount++;
            continue;
          }
        }
        if (!acct?.id) {
          skippedUnknownAccount++;
          continue;
        }
      }

      builtTxs.push({
        id: makeId('tx'),
        accountId: acct!.id,
        date: isoDate,
        type: p.type,
        amount,
        category: categoryFinal,
        description: descFinal || undefined,
        name: descClean || undefined,
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
        skippedBadAmountOrDate,
        skippedMissingAccountName,
        skippedInvalidType,
        skippedInvalidAccountForType,
        skippedTransferMissingAccountB,
        skippedCouldNotCreateAccount,
      },
    };
  };

  const handleRebuildRecurringNow = useCallback(async () => {
    try {
      if (!txs.length) {
        Alert.alert('No transactions', 'There are no transactions to rebuild recurring from.');
        return;
      }

      // If user selected importedOnly, there's no "import batch" here.
      // Treat it as last18Months to avoid confusion / heavy processing.
      const effectiveMode =
        recurringRebuildMode === 'importedOnly' ? 'last18Months' : recurringRebuildMode;

      startProgress('Rebuilding recurring…');
      updateProgress({
        stage: 'recurring',
        message: `Rebuilding recurring (${effectiveMode})…`,
        toImport: txs.length,
      });
      await yieldToUI();

      setLastStatus(
        effectiveMode === 'none'
          ? 'Recurring rebuild skipped (mode: none).'
          : `Rebuilding recurring (${effectiveMode})...`
      );

      if (effectiveMode === 'none') {
        finishProgress('Recurring rebuild skipped (mode: none).');
        return;
      }

      let sourceTxs: Transaction[] = txs;
      if (effectiveMode === 'last18Months') sourceTxs = filterTxsToLastMonths(txs, 18);
      // else 'all' uses txs

      const nextRecurring = await buildRecurringFromTransactionsChunked({
        txs: sourceTxs,
        chunkSize: 800,
        onProgress: ({ phase, processed, total }) => {
          updateProgress({
            message:
              phase === 'grouping'
                ? `Recurring: grouping… (${processed}/${total})`
                : `Recurring: building… (${processed}/${total})`,
          });
        },
      });

      updateProgress({ stage: 'saving', message: 'Saving recurring…' });
      await yieldToUI();

      actions.replaceAllData({
        accounts,
        transactions: txs,
        recurring: nextRecurring,
        budgets,
      });

      setLastStatus(`Recurring rebuilt: ${nextRecurring.length} items (${effectiveMode}).`);
      setLastImportSummary((prev) => {
        const extra = `Recurring rebuilt manually: ${nextRecurring.length} (${effectiveMode})`;
        return prev ? `${prev}\n${extra}` : extra;
      });

      finishProgress(`Recurring rebuilt: ${nextRecurring.length} items (${effectiveMode}).`);
    } catch (err: any) {
      console.error('Manual recurring rebuild failed:', err);
      const msg = err?.message || String(err) || 'Unknown error';
      failProgress(`Recurring rebuild failed: ${msg}`);
      Alert.alert('Recurring rebuild failed', msg);
      setLastStatus(`Recurring rebuild failed: ${msg}`);
    }
  }, [txs, recurring, recurringRebuildMode, actions, accounts, budgets, startProgress, updateProgress, finishProgress, failProgress]);

  const handleApplyCsvRestore = () => {
    if (!importCsvText.trim()) {
      setLastStatus('Pick a CSV file first.');
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
            // Yield to UI thread to prevent watchdog kill
            await yieldToUI();

            const built = buildCsvTransactions(importCsvText);

            const finalTxs = csvRestoreMode === 'replace' ? built.builtTxs : [...txs, ...built.builtTxs];

            // Skip rebuilding recurring during restore to avoid blocking (keep existing recurring)
            // User can rebuild recurring separately if needed
            actions.replaceAllData({
              accounts: built.newAccounts,
              transactions: finalTxs,
              recurring, // keep existing recurring to avoid heavy CPU work during restore
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
            summaryLines.push(`Skipped invalid amount/date: ${built.stats.skippedBadAmountOrDate}`);
            summaryLines.push(`Skipped missing account name: ${built.stats.skippedMissingAccountName}`);
            if ((built.stats.skippedTransferMissingAccountB ?? 0) > 0) {
              summaryLines.push(`Transfer rows missing Account B (to-account) skipped: ${built.stats.skippedTransferMissingAccountB}`);
            }
            summaryLines.push(`Account creation failed: ${built.stats.skippedCouldNotCreateAccount}`);
            summaryLines.push(`Recurring items: (not rebuilt during restore - use "Rebuild recurring" button if needed)`);

            setLastImportSummary(summaryLines.join('\n'));
            setLastStatus('CSV restore/merge completed. Recurring items not rebuilt (use "Rebuild recurring" button if needed).');
            setShowTemplatePreview(false);
            setShowExportPreview(false);
            setShowCsvPreview(false);

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

        <Pressable style={styles.btnSecondaryFull} onPress={handlePickJsonBackup}>
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

        <Pressable
          style={[styles.btnSecondaryFull, !jsonPreview && styles.btnSecondaryDisabled]}
          onPress={() => setShowPreview((v) => !v)}
          disabled={!jsonPreview}
        >
          <Text style={[styles.btnPrimaryText, !jsonPreview && styles.btnSecondaryTextDisabled]}>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </Text>
        </Pressable>

        {showPreview && jsonPreview ? (
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

      {/* CSV TEMPLATE
          App Store Connect / Apple reviewer note (copy when updating):
          "DebitLens supports CSV import using a provided template (exportable in-app). Required fields: Date, Amount, Description, Category, Type, and Account A or Account B. Extra columns are ignored."
      */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV Template (Import Format)</Text>
        <Text style={styles.sectionText}>
          Use this template to format transactions for importing into DebitLens.
        </Text>
        <Text style={styles.sectionText}>
          Required columns: Date, Amount, Description, Category, Type, and Account A or Account B (at least one).
          Extra columns are allowed and will be ignored.
        </Text>
        <Text style={styles.sectionText}>
          • Date format recommended: YYYY-MM-DD{'\n'}
          • Type must be: expense, income, or transfer{'\n'}
          • For transfers, include both Account A and Account B (from → to)
        </Text>
        <Text style={styles.subtle}>
          If you see “Missing required columns: Account A or Account B”, your CSV header row must include at least one of those columns.
        </Text>

        <Pressable
          style={styles.btnSecondaryFull}
          onPress={() => setShowTemplatePreview((v) => !v)}
        >
          <Text style={[styles.btnPrimaryText, showTemplatePreview && styles.btnSecondaryTextActive]}>
            {showTemplatePreview ? 'Hide preview' : 'Show preview'}
          </Text>
        </Pressable>

        {showTemplatePreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>Preview (read-only):</Text>
            <Text style={[styles.sectionText, { marginBottom: 6 }]}>
              Copy this format into your own spreadsheet, then save as CSV.
            </Text>
            <ScrollView style={styles.csvPreviewScroll} nestedScrollEnabled>
              <Text selectable style={styles.csvPreviewText}>
                {templateCsvText}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleExportCsvPreview}>
          <Text style={styles.btnPrimaryText}>Export Template CSV (Files)</Text>
        </Pressable>

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
          style={[styles.btnSecondaryFull, isTransactionsCsvGenerated && styles.btnSecondaryActive]} 
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
          style={[styles.btnSecondaryFull, !exportCsvText.trim() && styles.btnSecondaryDisabled]}
          onPress={() => setShowExportPreview((v) => !v)}
          disabled={!exportCsvText.trim()}
        >
          <Text style={[styles.btnPrimaryText, !exportCsvText.trim() && styles.btnSecondaryTextDisabled]}>
            {showExportPreview ? 'Hide preview' : 'Show preview'}
          </Text>
        </Pressable>

        {showExportPreview && exportCsvText.trim() ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>Transactions CSV preview</Text>
            <ScrollView style={styles.csvPreviewScroll} nestedScrollEnabled>
              <Text selectable style={styles.csvPreviewText}>
                {(() => {
                  const lines = exportCsvText.split(/\r?\n/);
                  const maxLines = 100;
                  const truncated = lines.length > maxLines;
                  const previewContent = truncated ? lines.slice(0, maxLines).join('\n') : exportCsvText;
                  return truncated ? `${previewContent}\n\n… truncated (${lines.length} total lines)` : previewContent;
                })()}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        <Pressable 
          style={[styles.btnPrimary, !isTransactionsCsvGenerated && styles.btnPrimaryDisabled]} 
          onPress={handleExportCsvFile}
          disabled={!isTransactionsCsvGenerated}
        >
          <Text style={[styles.btnPrimaryText, !isTransactionsCsvGenerated && styles.btnPrimaryTextDisabled]}>
            Export Transactions CSV (Files)
          </Text>
        </Pressable>

      </View>

      {/* CSV IMPORT + RESTORE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV import / restore</Text>
        <Text style={styles.sectionText}>
          CSV import is limited to 200 rows per batch for stability. If your file has more rows, use Continue import to import the next batch. Pick a CSV file, then import (append) or restore (replace/merge).
        </Text>

        <Text style={styles.subtle}>
          Note: DebitLens imports <Text style={styles.bold}>CSV</Text> files. If you have an Excel file (.xlsx), export or
          "Save As" <Text style={styles.bold}>CSV (Comma delimited)</Text> first.
        </Text>

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

        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>Recurring rebuild mode</Text>
          <View style={styles.rowButtons}>
            <Pressable
              style={[
                styles.btnSecondary,
                recurringRebuildMode === 'none' && styles.btnSecondaryActive,
              ]}
              onPress={() => setRecurringRebuildMode('none')}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  recurringRebuildMode === 'none' && styles.btnSecondaryTextActive,
                ]}
              >
                None
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnSecondary,
                recurringRebuildMode === 'last18Months' && styles.btnSecondaryActive,
              ]}
              onPress={() => setRecurringRebuildMode('last18Months')}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  recurringRebuildMode === 'last18Months' && styles.btnSecondaryTextActive,
                ]}
              >
                18mo
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnSecondary,
                recurringRebuildMode === 'all' && styles.btnSecondaryActive,
              ]}
              onPress={() => setRecurringRebuildMode('all')}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  recurringRebuildMode === 'all' && styles.btnSecondaryTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Controls rebuild scope: None (keep current), Last 18 months (recommended), or All data (slow).
          </Text>
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

        <Pressable
          style={[styles.btnSecondaryFull, !importCsvText.trim() && styles.btnSecondaryDisabled]}
          onPress={() => setShowCsvPreview((v) => !v)}
          disabled={!importCsvText.trim()}
        >
          <Text style={[styles.btnPrimaryText, !importCsvText.trim() && styles.btnSecondaryTextDisabled]}>
            {showCsvPreview ? 'Hide preview' : 'Show preview'}
          </Text>
        </Pressable>

        {showCsvPreview && importCsvText.trim() ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>CSV preview</Text>
            <ScrollView style={styles.csvPreviewScroll} nestedScrollEnabled>
              <Text selectable style={styles.csvPreviewText}>
                {(() => {
                  const lines = importCsvText.split(/\r?\n/);
                  const maxLines = 100;
                  const truncated = lines.length > maxLines;
                  const previewContent = truncated ? lines.slice(0, maxLines).join('\n') : importCsvText;
                  return truncated ? `${previewContent}\n\n… truncated (${lines.length} total lines)` : previewContent;
                })()}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.rowButtons}>
          <Pressable 
            style={[styles.btnDestructive, progress.active && styles.btnPrimaryDisabled]} 
            onPress={handleApplyCsvImportPress}
            disabled={progress.active}
          >
            <Text style={[styles.btnDestructiveText, progress.active && styles.btnPrimaryTextDisabled]}>
              Apply CSV import
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.btnSecondaryFull, (!importCsvText.trim() || !importHasMoreBatches) && styles.btnSecondaryDisabled]}
          onPress={handleContinueCsvImportPress}
          disabled={!importCsvText.trim() || !importHasMoreBatches || progress.active}
        >
          <Text style={[styles.btnSecondaryText, (!importCsvText.trim() || !importHasMoreBatches) && styles.btnSecondaryTextDisabled]}>
            Continue import (next {MAX_CSV_IMPORT_ROWS})
          </Text>
        </Pressable>

        {pendingActive ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Pending import</Text>
            <Text style={styles.statusText}>
              Pending transactions: {pendingTxs.length}
            </Text>
            <Text style={styles.statusText}>
              Progress: {Math.min(importBatchOffset, importTotalDataRows)} / {importTotalDataRows}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.btnPrimary, (!pendingActive || pendingTxs.length === 0 || progress.active) && styles.btnPrimaryDisabled]}
          onPress={handleCommitPendingImport}
          disabled={!pendingActive || pendingTxs.length === 0 || progress.active}
        >
          <Text style={[styles.btnPrimaryText, (!pendingActive || pendingTxs.length === 0 || progress.active) && styles.btnPrimaryTextDisabled]}>
            Commit import (save to app)
          </Text>
        </Pressable>

        <Pressable
          style={[styles.btnSecondaryFull, (!pendingActive || progress.active) && styles.btnSecondaryDisabled]}
          onPress={async () => {
            Alert.alert('Discard pending import', 'This will remove pending imported data. Continue?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: async () => {
                  setPendingTxs([]);
                  setPendingAccounts([]);
                  setPendingActive(false);
                  existingKeysRef.current = null; // Clear de-dupe keys when discarding
                  await clearPending();
                  setLastStatus('Pending import discarded.');
                },
              },
            ]);
          }}
          disabled={!pendingActive || progress.active}
        >
          <Text style={[styles.btnSecondaryText, (!pendingActive || progress.active) && styles.btnSecondaryTextDisabled]}>
            Discard pending import
          </Text>
        </Pressable>

        {importCsvText.trim() ? (
          <Text style={styles.hint}>
            File: {importLastFilename || 'selected CSV'} • Imported: {Math.min(importBatchOffset, importTotalDataRows)} / {importTotalDataRows || '…'}
          </Text>
        ) : null}

        <Pressable
          style={[styles.btnSecondaryFull, !txs.length && styles.btnSecondaryDisabled]}
          onPress={handleRebuildRecurringNow}
          disabled={!txs.length}
        >
          <Text style={[styles.btnSecondaryText, !txs.length && styles.btnSecondaryTextDisabled]}>
            Rebuild recurring now (uses selected mode)
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          Rebuild recurring is optional and can be slow on large datasets. Use "Last 18 months" for best performance.
        </Text>

        {(progress.stage !== 'idle' && (progress.message || progress.active)) ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>
              {progress.active ? 'Working…' : progress.stage === 'error' ? 'Failed' : 'Done'}
            </Text>
            <Text style={styles.progressText}>
              {progress.message}
            </Text>
            <Text style={styles.progressMeta}>
              Stage: {progress.stage} • Elapsed: {progressElapsedSec}s
            </Text>
            {(progress.parsedRows || progress.toImport || progress.imported || progress.skipped) ? (
              <Text style={styles.progressMeta}>
                Parsed: {progress.parsedRows ?? 0} • To import: {progress.toImport ?? 0} • Imported: {progress.imported ?? 0} • Skipped: {progress.skipped ?? 0}
              </Text>
            ) : null}
          </View>
        ) : null}

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
            <Text style={styles.statusText}>Bad amount/date: {lastCsvStats.skippedBadAmountOrDate}</Text>
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
  subtle: { color: theme.textDim, marginBottom: 16, marginTop: 6, lineHeight: 18 },
  bold: { fontWeight: '800', color: theme.text },

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
  btnSecondaryDisabled: { opacity: 0.5 },
  btnSecondaryTextDisabled: { color: '#9CA3AF' },

  btnSecondaryFull: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },

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

  textBoxLabel: { color: theme.textDim, marginBottom: 4 },

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

  progressBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#020617',
  },
  progressTitle: { color: '#E5E7EB', fontWeight: '800', marginBottom: 4 },
  progressText: { color: '#E5E7EB' },
  progressMeta: { color: theme.textDim, marginTop: 6, fontSize: 12 },

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
  csvPreviewScroll: { maxHeight: 220, marginTop: 8 },
  csvPreviewText: {
    color: '#E5E7EB',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'monospace',
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
