import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { useApp } from '../state/AppContext';

// --- Work around expo-file-system typing quirks in this project ---
const FS: any = FileSystem;
const writeFileAsync = (
  uri: string,
  data: string,
  options?: { encoding?: string }
) => FS.writeAsStringAsync(uri, data, options);
const readFileAsync = (
  uri: string,
  options?: { encoding?: string }
) => FS.readAsStringAsync(uri, options);

type Props = {
  navigation: any;
};

export default function DataExportImportScreen({ navigation }: Props) {
  const { state, actions } = useApp();

  const [csvIncludeDescription, setCsvIncludeDescription] =
    React.useState(true);
  const [lastStatus, setLastStatus] = React.useState<string>('');

  // ====== SHARED BACKUP APPLY LOGIC (JSON full backup) ======
  const applyParsedBackup = React.useCallback(
    (parsed: any) => {
      if (!parsed || typeof parsed !== 'object' || !parsed.state) {
        Alert.alert(
          'Invalid backup format',
          'This JSON does not look like a DebitLens backup (missing "state" property).'
        );
        return;
      }

      const backupState: any = parsed.state;

      const accountsCount = Array.isArray(backupState.accounts)
        ? backupState.accounts.length
        : 0;
      const txCount = Array.isArray(backupState.transactions)
        ? backupState.transactions.length
        : 0;

      const version = parsed.version ?? 'n/a';
      const exportedAt = parsed.exportedAt ?? 'n/a';

      Alert.alert(
        'Restore from backup?',
        `Version: ${version}\nExported: ${exportedAt}\n\nAccounts: ${accountsCount}\nTransactions: ${txCount}\n\nDo you want to replace current data with this backup?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Apply backup',
            style: 'destructive',
            onPress: () => {
              actions.loadBackup(backupState);
              setLastStatus(
                `Backup applied. Version: ${version}, exported: ${exportedAt}.`
              );
            },
          },
        ]
      );
    },
    [actions, setLastStatus]
  );

  // ====== CSV EXPORT (transactions) ======
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
        const escaped = s.replace(/"/g, '""');
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

      const today = new Date().toISOString().slice(0, 10);
      const fileName = `debitlens-transactions-${today}.csv`;
      const fileUri = FS.documentDirectory + fileName;

      await writeFileAsync(fileUri, csvString, {
        encoding: 'utf8',
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Exported to file',
          `Your CSV has been saved here:\n\n${fileUri}\n\nSharing is not supported on this device/emulator.`
        );
        setLastStatus(`CSV exported to file: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Share transactions CSV',
        UTI: 'public.comma-separated-values-text',
      });

      setLastStatus('CSV exported and shared.');
    } catch (err) {
      console.error('CSV export/share failed', err);
      Alert.alert(
        'Export failed',
        'There was a problem exporting your CSV. Please try again.'
      );
      setLastStatus('CSV export failed.');
    }
  }, [state.transactions, csvIncludeDescription, setLastStatus]);

  // ====== CSV IMPORT (transactions) ======

  // Very small CSV parser for our simple export format
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        // Toggle quote mode or handle escaped quote ("")
        if (inQuotes && line[i + 1] === '"') {
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

  const parseCsv = (text: string): string[][] => {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map(parseCsvLine);
  };

  const handleImportCsvPress = React.useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0];
      if (!file) {
        Alert.alert(
          'No file selected',
          'Please choose a CSV file to import.'
        );
        return;
      }

      const content = await readFileAsync(file.uri, {
        encoding: 'utf8',
      });

      const rows = parseCsv(content);
      if (!rows.length) {
        Alert.alert('Empty CSV', 'The selected CSV file is empty.');
        return;
      }

      const header = rows[0];
      const body = rows.slice(1);

      const idxDate = header.indexOf('date');
      const idxAccountId = header.indexOf('accountId');
      const idxType = header.indexOf('type');
      const idxCategory = header.indexOf('category');
      const idxAmount = header.indexOf('amount');
      const idxDescription = header.indexOf('description');

      if (
        idxDate === -1 ||
        idxAccountId === -1 ||
        idxType === -1 ||
        idxAmount === -1
      ) {
        Alert.alert(
          'Invalid CSV format',
          'CSV must contain at least date, accountId, type, and amount columns.'
        );
        return;
      }

      let importedCount = 0;

      for (const row of body) {
        const date = row[idxDate];
        const accountId = row[idxAccountId];
        const type = row[idxType] as any;
        const category = idxCategory >= 0 ? row[idxCategory] : undefined;
        const amountRaw = row[idxAmount];
        const description =
          idxDescription >= 0 ? row[idxDescription] : undefined;

        if (!date || !accountId || !amountRaw || !type) {
          continue;
        }

        const amount = Number(amountRaw);
        if (!Number.isFinite(amount)) {
          continue;
        }

        // We rely on addTransaction to generate its own ID
        actions.addTransaction({
          accountId,
          date,
          type,
          category,
          amount,
          description,
        } as any);
        importedCount++;
      }

      Alert.alert(
        'CSV import complete',
        `Imported ${importedCount} transactions from CSV.`
      );
      setLastStatus(`Imported ${importedCount} transactions from CSV.`);
    } catch (err) {
      console.error('CSV import failed', err);
      Alert.alert(
        'Import failed',
        'There was a problem importing from CSV. Please try again.'
      );
      setLastStatus('CSV import failed.');
    }
  }, [actions, setLastStatus]);

  // ====== FULL BACKUP EXPORT (JSON) ======
  const handleExportBackupPress = React.useCallback(async () => {
    try {
      const backupPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        state, // full app state
      };

      const jsonString = JSON.stringify(backupPayload, null, 2);
      const iso = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `debitlens-backup-${iso}.json`;
      const fileUri = FS.documentDirectory + fileName;

      await writeFileAsync(fileUri, jsonString, {
        encoding: 'utf8',
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          'Backup created',
          `Your backup file has been saved here:\n\n${fileUri}\n\nSharing is not supported on this device/emulator.`
        );
        setLastStatus(`Backup exported to file: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Share full DebitLens backup',
        UTI: 'public.json',
      });

      setLastStatus('Backup exported and shared.');
    } catch (err) {
      console.error('Backup export/share failed', err);
      Alert.alert(
        'Backup failed',
        'There was a problem creating or sharing the backup. Please try again.'
      );
      setLastStatus('Backup export failed.');
    }
  }, [state, setLastStatus]);

  // ====== RESTORE FROM BACKUP (JSON via DocumentPicker) ======
  const handleImportBackupPress = React.useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0];
      if (!file) {
        Alert.alert(
          'No file selected',
          'Please choose a backup file to restore.'
        );
        return;
      }

      const content = await readFileAsync(file.uri, {
        encoding: 'utf8',
      });

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        console.error('Failed to parse backup JSON', err);
        Alert.alert(
          'Invalid backup file',
          'The selected file is not valid JSON. Please choose a valid backup file.'
        );
        return;
      }

      applyParsedBackup(parsed);
    } catch (err) {
      console.error('Backup import failed', err);
      Alert.alert(
        'Import failed',
        'There was a problem reading the backup file. Please try again.'
      );
    }
  }, [applyParsedBackup]);

  // ====== RENDER ======
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>Data export &amp; import</Text>
      <Text style={styles.subtle}>
        Export and import your DebitLens data as CSV or JSON for backup,
        analysis, and restore.
      </Text>

      {lastStatus ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>{lastStatus}</Text>
        </View>
      ) : null}

      {/* CSV SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transactions (CSV)</Text>
        <Text style={styles.sectionHelp}>
          Export and import transactions in CSV format for spreadsheets and
          other tools.
        </Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Include description</Text>
          <Switch
            value={csvIncludeDescription}
            onValueChange={setCsvIncludeDescription}
          />
        </View>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleExportCsvPress}
        >
          <Text style={styles.btnSecondaryText}>
            Export transactions as CSV (file)
          </Text>
        </Pressable>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleImportCsvPress}
        >
          <Text style={styles.btnSecondaryText}>
            Import transactions from CSV
          </Text>
        </Pressable>
      </View>

      {/* JSON BACKUP SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Full backup (JSON)</Text>
        <Text style={styles.sectionHelp}>
          Create and restore full JSON backups of your DebitLens data via
          the Files / cloud storage apps.
        </Text>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleExportBackupPress}
        >
          <Text style={styles.btnSecondaryText}>
            Export full backup (JSON)
          </Text>
        </Pressable>

        <Pressable
          style={styles.btnDanger}
          onPress={handleImportBackupPress}
        >
          <Text style={styles.btnDangerText}>
            Restore from JSON backup (full replace)
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    paddingBottom: 32,
  },
  h1: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtle: {
    color: '#666',
    marginBottom: 16,
  },
  statusBox: {
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f3f3f7',
    marginBottom: 16,
  },
  statusLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  statusText: {
    color: '#555',
  },
  section: {
    marginBottom: 24,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9fb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionHelp: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 14,
  },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    marginTop: 4,
  },
  btnSecondaryText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  btnDanger: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#b00020',
  },
  btnDangerText: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
  },
});
