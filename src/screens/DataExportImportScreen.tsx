// src/screens/DataExportImportScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
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

import { useApp, type Account, type Transaction } from '../state/AppContext';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as theme } from '../theme/colors';

import {
  createBackupV1,
  parseAndValidateBackup,
  type BackupLatest,
} from '../utils/backup';

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

function normaliseBackup(raw: any): BackupPayload | null {
  if (!raw || typeof raw !== 'object') return null;

  // allow either {accounts,transactions,recurring} OR {state:{...}}
  const root = raw.state && typeof raw.state === 'object' ? raw.state : raw;

  const accounts = isArray(root.accounts) ? root.accounts : [];
  const transactions = isArray(root.transactions) ? root.transactions : [];
  const recurring = isArray(root.recurring) ? root.recurring : [];

  return { accounts, transactions, recurring };
}

function buildIdSet(items: any[]) {
  const s = new Set<string>();
  for (const x of items) if (x && typeof x.id === 'string') s.add(x.id);
  return s;
}

function validateBackup(payload: BackupPayload) {
  const issues: string[] = [];

  // basic shape checks
  if (!isArray(payload.accounts)) issues.push('accounts is not an array');
  if (!isArray(payload.transactions)) issues.push('transactions is not an array');
  if (!isArray(payload.recurring)) issues.push('recurring is not an array');

  // referential check: transaction.accountId must exist in accounts
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

/**
 * Small CSV helper – deliberately simple / conservative.
 */
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
   File write + share
=========================== */

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
   CSV import stats persistence
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

export default function DataExportImportScreen({ navigation }: Props) {
  const { state, actions } = useApp() as any;

  const accounts: Account[] = Array.isArray(state?.accounts) ? state.accounts : [];
  const txs: Transaction[] = Array.isArray(state?.transactions) ? state.transactions : [];
  const recurring = Array.isArray(state?.recurring) ? state.recurring : [];
  const budgets = Array.isArray(state?.budgets) ? state.budgets : [];

  const [lastStatus, setLastStatus] = useState<string>('');

  /* ===========================
     JSON BACKUP (EXPORT + RESTORE)
  =========================== */

  const [jsonPreview, setJsonPreview] = useState<BackupLatest | null>(null);
  const [jsonRestoreMode, setJsonRestoreMode] = useState<'replace' | 'merge'>('replace');

  const handleExportJsonFile = async () => {
    try {
      // NOTE: budgets are NOT included in backup format yet (utils/backup types)
      // We will add budgets once backup.ts is updated.
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

      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset?.uri) throw new Error('No file selected.');

      if (!FS.readAsStringAsync) {
        throw new Error('expo-file-system is not available. Install expo-file-system.');
      }

      const text = await FS.readAsStringAsync(asset.uri);
      const parsed = parseAndValidateBackup(text);

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
      // ✅ preserve existing budgets (backup format doesn’t include budgets yet)
      budgets,
    });
  };

  const applyJsonMerge = () => {
    if (!jsonPreview) return;

    const existingAccounts = accounts;
    const existingTxs = txs;
    const existingRecurring = recurring;

    const accIds = new Set(existingAccounts.map((a: any) => a.id));
    const txIds = new Set(existingTxs.map((t: any) => t.id));
    const recIds = new Set(existingRecurring.map((r: any) => r.id));

    const addAccounts = jsonPreview.app.accounts.filter((a) => a?.id && !accIds.has(a.id));
    const addTxs = jsonPreview.app.transactions.filter((t) => t?.id && !txIds.has(t.id));
    const addRecurring = jsonPreview.app.recurring.filter((r) => r?.id && !recIds.has(r.id));

    actions.replaceAllData({
      accounts: [...existingAccounts, ...addAccounts],
      transactions: [...existingTxs, ...addTxs],
      recurring: [...existingRecurring, ...addRecurring],
      // ✅ preserve existing budgets
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
      if (a && a.id) map[a.id] = a.name ?? a.id;
    }
    return map;
  }, [accounts]);

  const [exportCsvText, setExportCsvText] = useState<string>('');

  const handleGenerateCsv = () => {
    if (!txs.length) {
      Alert.alert('No transactions', 'There are no transactions to export.');
      setLastStatus('No transactions to export.');
      return;
    }

    const headers: string[] = ['date', 'type', 'amount'];
    if (csvIncludeAccountName) headers.push('account_name');
    if (csvIncludeDescription) headers.push('description');

    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(','));

    for (const t of txs) {
      const row: (string | number)[] = [];
      row.push(t.date ?? '');
      row.push(t.type ?? '');
      row.push(t.amount ?? 0);
      if (csvIncludeAccountName) row.push(accountNameById[t.accountId] ?? '');
      if (csvIncludeDescription) row.push((t as any).description ?? '');
      lines.push(row.map(csvEscape).join(','));
    }

    const csv = lines.join('\n');
    setExportCsvText(csv);
    setLastStatus('CSV generated. You can export it to Files below.');
  };

  const handleExportCsvFile = async () => {
    try {
      if (!exportCsvText.trim()) {
        Alert.alert('CSV not ready', 'Generate the CSV first.');
        return;
      }

      const filename = `DebitLens_Transactions_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.csv`;

      await writeAndShareFile(filename, exportCsvText, 'text/csv');
      setLastStatus('CSV exported to Files (via Share).');
    } catch (err: any) {
      console.error(err);
      setLastStatus(`CSV export failed: ${String(err?.message ?? err)}`);
      Alert.alert('Export failed', 'Could not export CSV file.');
    }
  };

  /* ===========================
     CSV IMPORT (existing flow + persisted stats)
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
          .map((a) => (a && typeof a.name === 'string' ? a.name.trim() : ''))
          .filter((n) => n.length > 0)
      ),
    [accounts]
  );

  const handlePickCsvFile = async () => {
    try {
      setCsvHasHeaderRow(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setLastStatus('File selection cancelled.');
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset || !asset.uri) {
        setLastStatus('No file selected or file has no URI.');
        return;
      }

      if (!FS.readAsStringAsync) {
        throw new Error('expo-file-system is not available. Install expo-file-system.');
      }

      const fileContents = await FS.readAsStringAsync(asset.uri);

      setImportCsvText(fileContents);
      setImportSource('file');
      setCsvPreview('');
      setCsvPreviewSourceName('');
      setLastImportSummary('');

      setLastStatus(
        `Loaded CSV from file: ${asset.name ?? 'selected file'}. Preview, import, or restore it.`
      );
    } catch (err: any) {
      console.error('Error picking CSV file', err);
      Alert.alert('File error', 'Something went wrong while reading the CSV file.');
      setLastStatus(`File error: ${String(err?.message ?? err)}`);
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

      const maxPreviewRows = 10;
      const previewRows = dataRows.slice(0, maxPreviewRows);

      const previewLines: string[] = [];
      if (headerRow) previewLines.push('HEADER: ' + headerRow.join(' | '));
      else previewLines.push('No header row (First row is header = OFF)');

      previewLines.push('--- Sample rows ---');
      for (const row of previewRows) previewLines.push(row.join(' | '));
      if (dataRows.length > maxPreviewRows) {
        previewLines.push(`…plus ${dataRows.length - maxPreviewRows} more rows`);
      }

      setCsvPreview(previewLines.join('\n'));

      let accountColIndex = -1;
      if (headerRow) {
        const headerLower = headerRow.map((h) => h.toLowerCase());
        accountColIndex = headerLower.findIndex(
          (h) => h === 'account' || h === 'account_name' || h === 'account name'
        );
      }

      if (accountColIndex >= 0) {
        let matchedCount = 0;
        let unknownCount = 0;

        for (const row of dataRows) {
          if (accountColIndex >= row.length) continue;
          const accName = row[accountColIndex].trim();
          if (!accName) continue;
          if (knownAccountNames.has(accName)) matchedCount++;
          else unknownCount++;
        }

        setCsvPreviewSourceName(
          `Detected account column at index ${accountColIndex}. ` +
            `Known accounts: ${matchedCount}. Unknown: ${unknownCount}. ` +
            (createMissingAccounts
              ? 'Unknown accounts will be created.'
              : 'Unknown accounts will be skipped.')
        );
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

  const handleApplyCsvImportPress = () => {
  if (!importCsvText.trim()) {
    setLastStatus('Paste CSV text or pick a file first.');
    return;
  }

  // --- Helpers (local to import) ---
  const cleanDescription = (s: unknown) => {
    let v = String(s ?? '').replace(/\u00A0/g, ' ').trim();
    if (!v) return '';

    // Remove common bank reference noise (keep merchant core)
    // Examples: "Ad free for PrimeV353-12477661" -> "Ad free for Prime"
    //           "AMZNMktplace*2O4PZamazon.co.uk" -> "AMZNMktplace amazon.co.uk"
    v = v.replace(/\*[A-Z0-9]{3,}/gi, ' ');             // *32993 / *2O4PZ
    v = v.replace(/\b\d{3,}[-/]\d{2,}\b/g, ' ');        // 353-12477661
    v = v.replace(/\b\d{6,}\b/g, ' ');                 // long digit sequences
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
    // Remove commas and any currency symbols/spaces
    const cleaned = s.replace(/[£$\s]/g, '').replace(/,/g, '');
    const n = Number(cleaned);
    if (!isFinite(n) || isNaN(n)) return null;
    return n;
  };

  // Build a stable de-dupe key
  const makeTxnKey = (input: {
    accountId: string;
    dateISO: string;
    type: string;
    amountAbs: number;
    descClean: string;
  }) => {
    const amt = Number(input.amountAbs || 0).toFixed(2);
    // include type to prevent expense/income collisions
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

            // Default order (old): date, account, amount, type, description, category
            // New template order: Date, Account, Amount, Description, Category, Type
            let dateCol = 0;
            let accountCol = 1;
            let amountCol = 2;
            let typeCol = 3;
            let descriptionCol = 4;
            let categoryCol = 5;

            if (headerRow) {
              const headerLower = headerRow.map(normalizeHeader);
              const findIndex = (names: string[]) =>
                headerLower.findIndex((h) => names.includes(h));

              // Support both old and new header naming conventions
              const dateIdx = findIndex(['date', 'tx_date', 'txn_date']);
              const accIdx = findIndex(['account', 'account_name', 'account name']);
              const amountIdx = findIndex(['amount', 'value']);
              const descIdx = findIndex(['description', 'desc', 'details', 'note']);
              const catIdx = findIndex(['category', 'cat', 'category_name', 'category name']);
              const typeIdx = findIndex(['type', 'txn_type', 'tx_type']);

              if (dateIdx >= 0) dateCol = dateIdx;
              if (accIdx >= 0) accountCol = accIdx;
              if (amountIdx >= 0) amountCol = amountIdx;
              if (descIdx >= 0) descriptionCol = descIdx;
              if (catIdx >= 0) categoryCol = catIdx;
              if (typeIdx >= 0) typeCol = typeIdx;

              // If the CSV is exactly your new template header order, this will naturally map correctly.
              // If Type is last, typeCol will become that column via typeIdx above.
            }

            let importedCount = 0;
            let skippedUnknownAccount = 0;
            let skippedBadAmount = 0;
            let skippedMissingAccountName = 0;
            let createdAccountsCount = 0;
            let skippedCouldNotCreateAccount = 0;
            let skippedDuplicate = 0;

            const createdAccountByName: Record<string, any> = {};

            // Build existing transaction key set (so re-imports don’t duplicate)
            // If you have txs in scope already, use that. Otherwise use state.transactions.
            const existingTxs = txs || []; // <— assumes `txs` exists like in your other screens
            const existingKeys = new Set<string>();

            for (const t of existingTxs) {
              const accountId = String((t as any).accountId ?? '');
              const dateISO = String((t as any).date ?? '');
              const type = String((t as any).type ?? '');
              const amountAbs = Math.abs(Number((t as any).amount ?? 0));
              const descClean = cleanDescription((t as any).description ?? (t as any).name ?? '');
              if (!accountId || !dateISO || !type) continue;
              existingKeys.add(makeTxnKey({ accountId, dateISO, type, amountAbs, descClean }));
            }

            for (const row of dataRows) {
              if (!row.length) continue;

              const dateStr = row[dateCol] ?? '';
              const typeStrRaw = row[typeCol] ?? '';
              const amountRaw = row[amountCol] ?? '';
              const rawDesc = row[descriptionCol] ?? '';
              const category = row[categoryCol] ?? '';
              const rawAccountName = row[accountCol] ?? '';

              const accountKey = norm(String(rawAccountName));
              const accountName = String(rawAccountName).trim();

              if (!accountName) {
                skippedMissingAccountName++;
                continue;
              }

              let accountForRow: any =
                createdAccountByName[accountKey] ??
                accounts.find((a) => a?.name && norm(a.name) === accountKey);

              if (!accountForRow) {
                if (!createMissingAccounts) {
                  skippedUnknownAccount++;
                  continue;
                }

                let newAccount: any;
                try {
                  newAccount = actions.addAccount({
                    name: accountName,
                    type: 'bank',
                    balance: 0,
                  });
                } catch (err) {
                  console.error('Error creating account from CSV row', err);
                }

                if (!newAccount || !newAccount.id) {
                  skippedCouldNotCreateAccount++;
                  continue;
                }

                createdAccountsCount++;
                createdAccountByName[accountKey] = newAccount;
                accountForRow = newAccount;
              }

              const amountNum = parseAmount(amountRaw);
              if (amountNum === null) {
                skippedBadAmount++;
                continue;
              }

              const dateISO = normalizeDateToISODate(String(dateStr || ''));
              if (!dateISO) {
                // If normalizeDateToISODate can return empty on failure, treat it like bad data
                skippedBadAmount++;
                continue;
              }

              const typeFromCell = parseTypeCell(typeStrRaw);

              // Determine final type:
              // 1) If Type column is provided (Expense/Income/Transfer), trust it
              // 2) Else infer from amount sign
              // 3) Else fall back to your normalizeType helper
              let finalType: 'income' | 'expense' | 'transfer';
              if (typeFromCell) {
                finalType = typeFromCell;
              } else if (amountNum < 0) {
                finalType = 'expense';
              } else if (amountNum > 0) {
                finalType = 'income';
              } else {
                // amount is 0; try your existing helper (likely returns income/expense)
                finalType = (normalizeType(typeStrRaw, amountNum) as any) || 'expense';
              }

              // Store amount as absolute (consistent with the rest of your app),
              // but be aware: transfers might want separate handling later.
              const amountAbs = Math.abs(amountNum);

              const descClean = cleanDescription(rawDesc);
              const descFinal = String(rawDesc ?? '').replace(/\u00A0/g, ' ').trim();

              // De-dupe
              const key = makeTxnKey({
                accountId: accountForRow.id,
                dateISO,
                type: finalType,
                amountAbs,
                descClean: descClean || descFinal,
              });

              if (existingKeys.has(key)) {
                skippedDuplicate++;
                continue;
              }
              existingKeys.add(key);

              actions.addTransaction({
                accountId: accountForRow.id,
                amount: amountAbs,
                type: finalType as any,
                date: dateISO,

                // ✅ Keep BOTH:
                name: descClean || undefined, // merchant-normalised for recurring detection
                description: descFinal || undefined, // original bank text for reference

                category: String(category || '').trim() || undefined,
              });


              importedCount++;
            }

            const summaryLines: string[] = [];
            summaryLines.push(`Imported transactions: ${importedCount}`);
            summaryLines.push(`New accounts created from CSV: ${createdAccountsCount}`);
            summaryLines.push(`Skipped duplicates: ${skippedDuplicate}`);
            summaryLines.push(`Skipped unknown accounts: ${skippedUnknownAccount}`);
            summaryLines.push(`Skipped invalid amount/date: ${skippedBadAmount}`);
            summaryLines.push(`Skipped missing account name: ${skippedMissingAccountName}`);
            summaryLines.push(`Account creation failed: ${skippedCouldNotCreateAccount}`);

            const summary = summaryLines.join('\n');
            setLastImportSummary(summary);
            setLastStatus('CSV import completed. See summary below.');

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
     CSV RESTORE (NEW)
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

    let dateCol = 0;
    let accountCol = 1;
    let amountCol = 2;
    let typeCol = 3;
    let descriptionCol = 4;
    let categoryCol = 5;

    if (headerRow) {
      const headerLower = headerRow.map((h) => h.toLowerCase());
      const findIndex = (names: string[]) => headerLower.findIndex((h) => names.includes(h));

      const dateIdx = findIndex(['date', 'tx_date', 'txn_date']);
      const typeIdx = findIndex(['type', 'txn_type', 'tx_type']);
      const amountIdx = findIndex(['amount', 'value']);
      const accIdx = findIndex(['account', 'account_name', 'account name']);
      const descIdx = findIndex(['description', 'desc', 'details', 'note']);
      const catIdx = findIndex(['category', 'cat', 'category_name', 'category name']);

      if (dateIdx >= 0) dateCol = dateIdx;
      if (accIdx >= 0) accountCol = accIdx;
      if (amountIdx >= 0) amountCol = amountIdx;
      if (typeIdx >= 0) typeCol = typeIdx;
      if (descIdx >= 0) descriptionCol = descIdx;
      if (catIdx >= 0) categoryCol = catIdx;
    }

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

      const rawDate = row[dateCol] ?? '';
      const rawType = row[typeCol] ?? '';
      const rawAmountStr = row[amountCol] ?? '';
      const accountName = String(row[accountCol] ?? '').trim();
      const description = String(row[descriptionCol] ?? '').trim();
      const category = String(row[categoryCol] ?? '').trim();

      if (!accountName) {
        skippedMissingAccountName++;
        continue;
      }

      const amountNum = Number(String(rawAmountStr).replace(/,/g, ''));
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
          }) as Account;

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
      const name = description || category || 'Imported';

      builtTxs.push({
        id: makeId('tx'),
        name,
        accountId: acct.id,
        date: isoDate,
        type: finalType,
        amount,
        category: category || undefined,
        description: description || undefined,
      });

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

            const finalTxs =
              csvRestoreMode === 'replace' ? built.builtTxs : [...txs, ...built.builtTxs];

            actions.replaceAllData({
              accounts: built.newAccounts,
              transactions: finalTxs,
              recurring, // unchanged
              budgets,   // ✅ preserve budgets during CSV restore/merge
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

            setLastImportSummary(summaryLines.join('\n'));
            setLastStatus('CSV restore/merge completed.');

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
              <Text style={styles.btnDestructiveText}>
                Apply JSON restore ({jsonRestoreMode})
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* CSV EXPORT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV export</Text>
        <Text style={styles.sectionText}>Generate CSV, then export it to Files.</Text>

        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>CSV export options</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Include description</Text>
            <Switch value={csvIncludeDescription} onValueChange={setCsvIncludeDescription} />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Include account name</Text>
            <Switch value={csvIncludeAccountName} onValueChange={setCsvIncludeAccountName} />
          </View>
        </View>

        <Pressable style={styles.btnSecondary} onPress={handleGenerateCsv}>
          <Text style={styles.btnSecondaryText}>Generate CSV (text)</Text>
        </Pressable>

        <Pressable style={styles.btnPrimary} onPress={handleExportCsvFile}>
          <Text style={styles.btnPrimaryText}>Export CSV file (Files)</Text>
        </Pressable>

        {exportCsvText ? (
          <View style={styles.textBox}>
            <Text style={styles.textBoxLabel}>Generated CSV (for reference)</Text>
            <ScrollView style={styles.textBoxScroll}>
              <Text selectable style={styles.monoText}>
                {exportCsvText}
              </Text>
            </ScrollView>
          </View>
        ) : null}
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
          <Switch
            value={csvRestoreMode === 'merge'}
            onValueChange={(v) => setCsvRestoreMode(v ? 'merge' : 'replace')}
          />
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

        <Text></Text>
        <Text style={styles.textBoxLabel}>Or paste CSV text below. (Scroll down if Apply button is missing)</Text>
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
          // editable={importSource !== 'file'}
          editable={true}

        />

        <View style={styles.rowButtons}>
          <Pressable style={styles.btnSecondary} onPress={handleParseCsvPress}>
            <Text style={styles.btnSecondaryText}>Preview CSV</Text>
          </Pressable>

          <Pressable style={styles.btnDestructive} onPress={handleApplyCsvImportPress}>
            <Text style={styles.btnDestructiveText}>Apply CSV import</Text>
          </Pressable>
        </View>

        {csvPreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>CSV preview (read-only)</Text>

            {csvPreviewSourceName ? (
              <Text style={styles.previewMeta}>{csvPreviewSourceName}</Text>
            ) : null}

            <View style={styles.previewScroll}>
              <Text selectable style={styles.previewText}>
                {csvPreview}
              </Text>
            </View>
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
  wrap: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 35,
    paddingBottom: 32,
  },
  h1: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionText: {
    color: '#D1D5DB',
    marginBottom: 10,
  },
  statLine: {
    color: '#E5E7EB',
    marginTop: 2,
  },
  btnPrimary: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  btnPrimaryText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
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
  btnSecondaryText: {
    color: '#E5E7EB',
    fontWeight: '600',
    textAlign: 'center',
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
  btnDestructiveText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  rowButtons: {
    flexDirection: 'row',
    marginTop: 4,
  },
  optionsBox: {
    marginTop: 8,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: theme.cardAlt,
  },
  optionsTitle: {
    color: '#E5E7EB',
    fontWeight: '600',
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  optionLabel: {
    color: '#D1D5DB',
    flex: 1,
    marginRight: 8,
  },

  textBox: {
    marginTop: 10,
    maxHeight: 260,
  },
  textBoxLabel: {
    color: theme.textDim,
    marginBottom: 4,
  },
  textBoxScroll: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#020617',
  },
  monoText: {
    color: '#E5E7EB',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }) as string,
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
  inputMultiline: {
    minHeight: 140,
  },
  statusBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusLabel: {
    color: theme.textDim,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusText: {
    color: '#E5E7EB',
  },
  previewBox: {
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: theme.border,
  },
  previewMeta: {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 8,
  },
  previewScroll: {
    maxHeight: 200,
  },
  previewText: {
    color: '#E5E7EB',
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 12,
  },
  hint: { opacity: 0.7, marginTop: 6 },

});
