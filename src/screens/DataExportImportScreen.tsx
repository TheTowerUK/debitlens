// src/screens/DataExportImportScreen.tsx
import React, { useMemo, useState } from 'react';
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
import { useApp,
  type Account,
  type Transaction,
 } from '../state/AppContext';

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  createBackupV1,
  parseAndValidateBackup,
  type BackupV1,
} from '../utils/backup';

const FS: any = FileSystem as any;

async function writeAndShareFile(
  filename: string,
  contents: string,
  mimeType: string
) {
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

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;


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

export default function DataExportImportScreen({ navigation }: Props) {
  // Keep as-any because you already chose this for flexibility
  const { state, actions } = useApp() as any;

  const accounts: Account[] = Array.isArray(state?.accounts) ? state.accounts : [];
  const txs: Transaction[] = Array.isArray(state?.transactions) ? state.transactions : [];
  const recurring = Array.isArray(state?.recurring) ? state.recurring : [];

  const [lastStatus, setLastStatus] = useState<string>('');

  /* ===========================
     JSON BACKUP (EXPORT + RESTORE)
  =========================== */

  const [jsonPreview, setJsonPreview] = useState<BackupV1 | null>(null);

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

  const handleApplyJsonRestore = () => {
    if (!jsonPreview) return;

    Alert.alert(
      'Confirm restore',
      'This will REPLACE your current accounts, transactions, and recurring items. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            actions.replaceAllData({
              accounts: jsonPreview.app.accounts,
              transactions: jsonPreview.app.transactions,
              recurring: jsonPreview.app.recurring,
            });
            setJsonPreview(null);
            setLastStatus('JSON restore applied (data replaced).');
          },
        },
      ]
    );
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

  const handleExportCsvPress = () => {
    if (!txs.length) {
      Alert.alert('No transactions', 'There are no transactions to export.');
      setLastStatus('No transactions to export.');
      return;
    }

    const headers: string[] = [];
    headers.push('date');
    headers.push('type');
    headers.push('amount');
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
      if (csvIncludeDescription) row.push(t.description ?? '');
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
     CSV IMPORT (your existing flow)
  =========================== */

  const [importCsvText, setImportCsvText] = useState<string>('');
  const [csvHasHeaderRow, setCsvHasHeaderRow] = useState<boolean>(true);
  const [csvPreview, setCsvPreview] = useState<string>('');
  const [csvPreviewSourceName, setCsvPreviewSourceName] = useState<string>('');
  const [lastImportSummary, setLastImportSummary] = useState<string>('');
  const [createMissingAccounts, setCreateMissingAccounts] = useState<boolean>(false);
  const [importSource, setImportSource] = useState<'manual' | 'file' | null>(null);

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

      setLastStatus(`Loaded CSV from file: ${asset.name ?? 'selected file'}. Preview or import it.`);
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
            `Rows with known accounts: ${matchedCount}. ` +
            `Rows with unknown accounts: ${unknownCount}. ` +
            (createMissingAccounts
              ? 'Unknown accounts will be created during import.'
              : 'Unknown accounts will be skipped.')
        );
      } else {
        setCsvPreviewSourceName(
          'No obvious account column detected in header. ' +
            'You can still import, but rows must map correctly by column order.'
        );
      }

      setLastImportSummary('');
      setLastStatus('CSV parsed successfully. Review the preview, then apply import.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('CSV parse error', 'Something went wrong while parsing the CSV text.');
      setLastStatus(`CSV parse error: ${String(err?.message ?? err)}`);
      setCsvPreview('');
      setCsvPreviewSourceName('');
      setLastImportSummary('');
    }
  };

  const handleApplyCsvImportPress = () => {
    if (!importCsvText.trim()) {
      setLastStatus('Paste CSV text or pick a file first.');
      return;
    }

    Alert.alert(
      'Confirm CSV import',
      createMissingAccounts
        ? 'This will import new transactions. If an account name does not exist, a new account will be created for it. Continue?'
        : 'This will import new transactions only for existing accounts. Unknown accounts are skipped and NOT created. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: () => {
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

              // Default order: date, account, amount, type, description, category
              let dateCol = 0;
              let accountCol = 1;
              let amountCol = 2;
              let typeCol = 3;
              let descriptionCol = 4;
              let categoryCol = 5;

              if (headerRow) {
                const headerLower = headerRow.map((h) => h.toLowerCase());
                const findIndex = (names: string[]) =>
                  headerLower.findIndex((h) => names.includes(h));

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

              let importedCount = 0;
              let skippedUnknownAccount = 0;
              let skippedBadAmount = 0;
              let skippedMissingAccountName = 0;
              let createdAccountsCount = 0;
              let skippedCouldNotCreateAccount = 0;

              const createdAccountByName: Record<string, Account> = {};

              for (const row of dataRows) {
                if (!row.length) continue;

                const dateStr = row[dateCol] ?? '';
                const typeStrRaw = row[typeCol] ?? '';
                const amountRaw = row[amountCol] ?? '';
                const accountName = (row[accountCol] ?? '').trim();
                const description = row[descriptionCol] ?? '';
                const category = row[categoryCol] ?? '';

                if (!accountName) {
                  skippedMissingAccountName++;
                  continue;
                }

                let accountForRow: Account | undefined = accounts.find(
                  (a) => a && typeof a.name === 'string' && a.name.trim() === accountName
                );

                if (!accountForRow && createdAccountByName[accountName]) {
                  accountForRow = createdAccountByName[accountName];
                }

                if (!accountForRow) {
                  if (!createMissingAccounts) {
                    skippedUnknownAccount++;
                    continue;
                  }

                  let newAccount: Account | undefined;
                  try {
                    // keep minimal: your addAccount may accept partial
                    newAccount = actions.addAccount({ name: accountName }) as Account | undefined;
                  } catch (err) {
                    console.error('Error creating account from CSV row', err);
                  }

                  if (!newAccount || !newAccount.id) {
                    skippedCouldNotCreateAccount++;
                    continue;
                  }

                  createdAccountsCount++;
                  createdAccountByName[accountName] = newAccount;
                  accountForRow = newAccount;
                }

                const amountNum = Number(String(amountRaw).replace(/,/g, ''));
                if (!isFinite(amountNum) || isNaN(amountNum)) {
                  skippedBadAmount++;
                  continue;
                }

                let csvType: 'income' | 'expense' | null = null;
                const typeLower = String(typeStrRaw).toLowerCase();

                if (typeLower === 'credit' || typeLower === 'income' || typeLower === 'in') {
                  csvType = 'income';
                } else if (
                  typeLower === 'debit' ||
                  typeLower === 'expense' ||
                  typeLower === 'out'
                ) {
                  csvType = 'expense';
                }

                const rawAmount = amountNum;

                const amount = Math.abs(rawAmount);

                let finalType: 'income' | 'expense';
                if (rawAmount < 0) finalType = 'expense';
                else if (rawAmount > 0) finalType = 'income';
                else finalType = csvType ?? 'expense';

                actions.addTransaction({
                  accountId: accountForRow.id,
                  amount,
                  type: finalType,
                  date: dateStr || new Date().toISOString().slice(0, 10),
                  description,
                  category: category || undefined,
                });

                importedCount++;
              }

              const summaryLines: string[] = [];
              summaryLines.push(`Imported transactions: ${importedCount}`);
              summaryLines.push(`New accounts created from CSV: ${createdAccountsCount}`);
              summaryLines.push(
                `Skipped rows with unknown account (when account creation disabled): ${skippedUnknownAccount}`
              );
              summaryLines.push(`Skipped rows with invalid amount: ${skippedBadAmount}`);
              summaryLines.push(`Skipped rows missing account name: ${skippedMissingAccountName}`);
              summaryLines.push(
                `Rows where account creation failed (no usable ID): ${skippedCouldNotCreateAccount}`
              );

              const summary = summaryLines.join('\n');
              setLastImportSummary(summary);
              setLastStatus('CSV import completed. See summary below.');
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

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Data export &amp; import</Text>
      <Text style={styles.subtle}>
        Export JSON/CSV to Files, restore from a JSON backup, or import transactions from CSV.
      </Text>

      {/* CURRENT SNAPSHOT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current data snapshot</Text>
        <Text style={styles.statLine}>Accounts: {accounts.length}</Text>
        <Text style={styles.statLine}>Transactions: {txs.length}</Text>
        <Text style={styles.statLine}>Recurring: {recurring.length}</Text>
      </View>

      {/* JSON BACKUP (EXPORT + RESTORE) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>JSON backup (export / restore)</Text>
        <Text style={styles.sectionText}>
          Export a full backup to Files and restore it later if needed.
        </Text>

        <Pressable style={styles.btnPrimary} onPress={handleExportJsonFile}>
          <Text style={styles.btnPrimaryText}>Export full backup as JSON (Files)</Text>
        </Pressable>

        <Pressable style={styles.btnSecondary} onPress={handlePickJsonBackup}>
          <Text style={styles.btnSecondaryText}>Select JSON backup to restore</Text>
        </Pressable>

        {jsonPreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>JSON preview</Text>
            <Text style={styles.previewMeta}>
              Exported: {jsonPreview.exportedAt}
            </Text>
            <Text style={styles.statLine}>Accounts: {jsonPreview.app.accounts.length}</Text>
            <Text style={styles.statLine}>Transactions: {jsonPreview.app.transactions.length}</Text>
            <Text style={styles.statLine}>Recurring: {jsonPreview.app.recurring.length}</Text>

            <Pressable style={styles.btnDestructive} onPress={handleApplyJsonRestore}>
              <Text style={styles.btnDestructiveText}>Apply JSON restore (replace)</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* CSV EXPORT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV export</Text>
        <Text style={styles.sectionText}>
          Generate CSV, then export it to Files.
        </Text>

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

        <Pressable style={styles.btnSecondary} onPress={handleExportCsvPress}>
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

      {/* CSV IMPORT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV import</Text>
        <Text style={styles.sectionText}>
          Pick a CSV file or paste CSV text below. Preview it, then import rows as transactions.
        </Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>First row is header</Text>
          <Switch value={csvHasHeaderRow} onValueChange={setCsvHasHeaderRow} />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Create missing accounts from CSV</Text>
          <Switch value={createMissingAccounts} onValueChange={setCreateMissingAccounts} />
        </View>

        <View style={styles.rowButtons}>
          <Pressable style={styles.btnSecondary} onPress={handlePickCsvFile}>
            <Text style={styles.btnSecondaryText}>Pick CSV file</Text>
          </Pressable>
        </View>

        <Text style={styles.textBoxLabel}>Or paste CSV text here</Text>
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
          editable={importSource !== 'file'}
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

        {lastStatus ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusText}>{lastStatus}</Text>
          </View>
        ) : null}

        {lastImportSummary ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Import summary</Text>
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
    backgroundColor: '#050816',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  h1: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#0B1020',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
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
    borderColor: '#111827',
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
    color: '#9CA3AF',
    marginBottom: 4,
  },
  textBoxScroll: {
    borderWidth: 1,
    borderColor: '#1F2937',
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
    borderColor: '#1F2937',
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
    backgroundColor: '#0B1020',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  statusLabel: {
    color: '#9CA3AF',
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
    borderColor: '#1F2937',
  },
  previewMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
  },
  previewScroll: {
    maxHeight: 200,
  },
  previewText: {
    color: '#E5E7EB',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
  },
});
