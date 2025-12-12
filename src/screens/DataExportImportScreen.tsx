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
import { useApp } from '../state/AppContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;

/**
 * Very loose shapes because different parts of the app may evolve over time.
 */
type Account = {
  id: string;
  name?: string;
  [key: string]: any;
};

type Transaction = {
  id?: string;
  accountId: string;
  amount: number;
  type?: 'income' | 'expense' | string;
  date?: string;
  description?: string;
  categoryId?: string | null;
  [key: string]: any;
};

type BackupPayload = {
  version: number;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
};

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
          // Escaped quote
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
  // Cast to any to avoid TS complaining about actions types that may not be fully defined.
  const { state, actions } = useApp() as any;

  const accounts: Account[] = Array.isArray(state?.accounts) ? state.accounts : [];
  const txs: Transaction[] = Array.isArray(state?.transactions) ? state.transactions : [];

  const [lastStatus, setLastStatus] = useState<string>('');

  // ----- JSON BACKUP (EXPORT ONLY) -----
  const [exportJsonText, setExportJsonText] = useState<string>('');

  const handleGenerateBackupJson = () => {
    try {
      const backup: BackupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts,
        transactions: txs,
      };
      const json = JSON.stringify(backup, null, 2);
      setExportJsonText(json);
      setLastStatus('Backup JSON generated. You can copy it from the box below.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to generate backup JSON.');
      setLastStatus('Failed to generate backup JSON.');
    }
  };

  // ----- CSV EXPORT -----
  const [csvIncludeDescription, setCsvIncludeDescription] = useState<boolean>(true);
  const [csvIncludeAccountName, setCsvIncludeAccountName] = useState<boolean>(true);

  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) {
      if (a && a.id) {
        map[a.id] = a.name ?? a.id;
      }
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
      if (csvIncludeAccountName) {
        row.push(accountNameById[t.accountId] ?? '');
      }
      if (csvIncludeDescription) {
        row.push(t.description ?? '');
      }
      lines.push(row.map(csvEscape).join(','));
    }

    const csv = lines.join('\n');
    setExportCsvText(csv);
    setLastStatus('CSV text generated. You can copy it from the box below.');
  };

  // ----- CSV IMPORT -----
  const [importCsvText, setImportCsvText] = useState<string>('');
  const [csvHasHeaderRow, setCsvHasHeaderRow] = useState<boolean>(true);
  const [csvPreview, setCsvPreview] = useState<string>('');
  const [csvPreviewSourceName, setCsvPreviewSourceName] = useState<string>('');
  const [lastImportSummary, setLastImportSummary] = useState<string>('');
  const [createMissingAccounts, setCreateMissingAccounts] = useState<boolean>(false);

  const knownAccountNames = useMemo(
    () =>
      new Set(
        accounts
          .map((a) => (a && typeof a.name === 'string' ? a.name.trim() : ''))
          .filter((n) => n.length > 0)
      ),
    [accounts]
  );

  /**
   * Pick a CSV file from device and load its contents into importCsvText.
   */
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

      // Use "as any" so TS stops complaining about missing readAsStringAsync / EncodingType
      const fs: any = FileSystem;
      const fileContents = await fs.readAsStringAsync(asset.uri);

      setImportCsvText(fileContents);
      setLastStatus(
        `Loaded CSV from file: ${asset.name ?? 'selected file'}. You can now preview or import it.`
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

      // Simple preview string
      const previewLines: string[] = [];
      if (headerRow) {
        previewLines.push('HEADER: ' + headerRow.join(' | '));
      } else {
        previewLines.push('No header row (First row is header = OFF)');
      }

      previewLines.push('--- Sample rows ---');
      for (const row of previewRows) {
        previewLines.push(row.join(' | '));
      }
      if (dataRows.length > maxPreviewRows) {
        previewLines.push(`…plus ${dataRows.length - maxPreviewRows} more rows`);
      }

      setCsvPreview(previewLines.join('\n'));

      // Quick look at account name matching (if we detect an account column).
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
              : 'Unknown accounts will be skipped (no new accounts created).')
        );
      } else {
        setCsvPreviewSourceName(
          'No obvious account column detected in header. ' +
            'You can still import, but rows must map correctly by column order.'
        );
      }

      setLastImportSummary('');
      setLastStatus('CSV parsed successfully. Review the preview, then tap "Apply CSV import" if happy.');
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

              let dateCol = 0;
              let typeCol = 1;
              let amountCol = 2;
              let accountCol = 3;
              let descriptionCol = 4;

              if (headerRow) {
                const headerLower = headerRow.map((h) => h.toLowerCase());
                const findIndex = (names: string[]) =>
                  headerLower.findIndex((h) => names.includes(h));

                const dateIdx = findIndex(['date', 'tx_date', 'txn_date']);
                const typeIdx = findIndex(['type', 'txn_type', 'tx_type']);
                const amountIdx = findIndex(['amount', 'value']);
                const accIdx = findIndex(['account', 'account_name', 'account name']);
                const descIdx = findIndex(['description', 'desc', 'details', 'note']);

                if (dateIdx >= 0) dateCol = dateIdx;
                if (typeIdx >= 0) typeCol = typeIdx;
                if (amountIdx >= 0) amountCol = amountIdx;
                if (accIdx >= 0) accountCol = accIdx;
                if (descIdx >= 0) descriptionCol = descIdx;
              }

              let importedCount = 0;
              let skippedUnknownAccount = 0;
              let skippedBadAmount = 0;
              let skippedMissingAccountName = 0;
              let createdAccountsCount = 0;
              let skippedCouldNotCreateAccount = 0;

              // Local map so multiple rows for the same new account share a single created account
              const createdAccountByName: Record<string, Account> = {};

              for (const row of dataRows) {
                if (!row.length) continue;

                const dateStr = row[dateCol] ?? '';
                const typeStr = (row[typeCol] ?? '').toLowerCase();
                const amountRaw = row[amountCol] ?? '';
                const accountName = (row[accountCol] ?? '').trim();
                const description = row[descriptionCol] ?? '';

                if (!accountName) {
                  skippedMissingAccountName++;
                  continue;
                }

                // Check if we already have this account (existing or already created in this import)
                let accountForRow: Account | undefined = accounts.find(
                  (a) => a && typeof a.name === 'string' && a.name.trim() === accountName
                );

                if (!accountForRow && createdAccountByName[accountName]) {
                  accountForRow = createdAccountByName[accountName];
                }

                // Not found anywhere
                if (!accountForRow) {
                  if (!createMissingAccounts) {
                    // User chose not to create new accounts
                    skippedUnknownAccount++;
                    continue;
                  }

                  // Create a new account
                  let newAccount: Account | undefined;
                  try {
                    newAccount = actions.addAccount({
                      name: accountName,
                    }) as Account | undefined;
                  } catch (err) {
                    console.error('Error creating account from CSV row', err);
                  }

                  if (!newAccount || !newAccount.id) {
                    // If addAccount doesn't return anything useful, we can't link transactions.
                    skippedCouldNotCreateAccount++;
                    continue;
                  }

                  createdAccountsCount++;
                  createdAccountByName[accountName] = newAccount;
                  accountForRow = newAccount;
                }

                // At this point we should have an account
                const amountNum = Number(String(amountRaw).replace(/,/g, ''));
                if (!isFinite(amountNum) || isNaN(amountNum)) {
                  skippedBadAmount++;
                  continue;
                }

                // Normalise type if present
                let normalisedType: 'income' | 'expense' | string = typeStr;
                if (typeStr === 'credit' || typeStr === 'income' || typeStr === 'in') {
                  normalisedType = 'income';
                } else if (
                  typeStr === 'debit' ||
                  typeStr === 'expense' ||
                  typeStr === 'out'
                ) {
                  normalisedType = 'expense';
                }

                actions.addTransaction({
                  accountId: accountForRow.id,
                  amount: amountNum,
                  type: normalisedType,
                  date: dateStr || new Date().toISOString().slice(0, 10),
                  description,
                } as Transaction);

                importedCount++;
              }

              const summaryLines: string[] = [];
              summaryLines.push(`Imported transactions: ${importedCount}`);
              summaryLines.push(
                `New accounts created from CSV: ${createdAccountsCount}`
              );
              summaryLines.push(
                `Skipped rows with unknown account (when account creation disabled): ${skippedUnknownAccount}`
              );
              summaryLines.push(`Skipped rows with invalid amount: ${skippedBadAmount}`);
              summaryLines.push(
                `Skipped rows missing account name: ${skippedMissingAccountName}`
              );
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
        Export your data as JSON/CSV, or import transactions from a CSV file. You
        can paste CSV text or pick a CSV file. You can also choose whether missing
        accounts should be created automatically during import.
      </Text>

      {/* CURRENT SNAPSHOT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current data snapshot</Text>
        <Text style={styles.statLine}>Accounts: {accounts.length}</Text>
        <Text style={styles.statLine}>Transactions: {txs.length}</Text>
      </View>

      {/* JSON BACKUP (EXPORT ONLY) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>JSON backup (export)</Text>
        <Text style={styles.sectionText}>
          Generate a JSON backup of your current data. You can copy this and keep
          it somewhere safe. (Restore wiring can be added later if needed.)
        </Text>

        <Pressable style={styles.btnPrimary} onPress={handleGenerateBackupJson}>
          <Text style={styles.btnPrimaryText}>Generate backup JSON</Text>
        </Pressable>

        {exportJsonText ? (
          <View style={styles.textBox}>
            <Text style={styles.textBoxLabel}>Backup JSON</Text>
            <ScrollView style={styles.textBoxScroll}>
              <Text selectable style={styles.monoText}>
                {exportJsonText}
              </Text>
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* CSV EXPORT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV export</Text>
        <Text style={styles.sectionText}>
          Export your transactions as CSV. You can copy the CSV text and save it
          as a `.csv` file via your file system.
        </Text>

        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>CSV export options</Text>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Include description</Text>
            <Switch
              value={csvIncludeDescription}
              onValueChange={setCsvIncludeDescription}
            />
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Include account name</Text>
            <Switch
              value={csvIncludeAccountName}
              onValueChange={setCsvIncludeAccountName}
            />
          </View>
        </View>

        <Pressable style={styles.btnSecondary} onPress={handleExportCsvPress}>
          <Text style={styles.btnSecondaryText}>
            Export transactions as CSV (text)
          </Text>
        </Pressable>

        {exportCsvText ? (
          <View style={styles.textBox}>
            <Text style={styles.textBoxLabel}>Exported CSV</Text>
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
          You can either pick a CSV file or paste CSV text below. We&apos;ll parse
          it and then import rows as transactions.
        </Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>First row is header</Text>
          <Switch value={csvHasHeaderRow} onValueChange={setCsvHasHeaderRow} />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Create missing accounts from CSV</Text>
          <Switch
            value={createMissingAccounts}
            onValueChange={setCreateMissingAccounts}
          />
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
          onChangeText={setImportCsvText}
          placeholder="Paste CSV text…"
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
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
          <View style={styles.textBox}>
            <Text style={styles.textBoxLabel}>CSV preview</Text>
            <ScrollView style={styles.textBoxScroll}>
              <Text selectable style={styles.monoText}>
                {csvPreview}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        {csvPreviewSourceName ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>CSV analysis</Text>
            <Text style={styles.statusText}>{csvPreviewSourceName}</Text>
          </View>
        ) : null}

      {/* GLOBAL STATUS */}
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
  strong: {
    fontWeight: '700',
    color: '#F97316',
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
});
