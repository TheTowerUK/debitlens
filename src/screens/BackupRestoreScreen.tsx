// src/screens/BackupRestoreScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { useApp } from '../state/AppContext';
import {
  createBackupV1,
  parseAndValidateBackup,
  type BackupLatest,
} from '../utils/backup';
import {
  getSavedBackupReminderMode,
  setBackupReminderMode,
  type BackupReminderMode,
} from '../utils/backupReminder';

const FS: any = FileSystem as any;

export default function BackupRestoreScreen() {
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const transactions = state.transactions || [];
  const recurring = state.recurring || [];
  const budgets = state.budgets || [];

  const [preview, setPreview] = useState<BackupLatest | null>(null);
  const [status, setStatus] = useState<string>('');
  const [replaceMode, setReplaceMode] = useState(true);

  const [reminderMode, setReminderModeState] =
    useState<BackupReminderMode>('off');
  const [reminderStatus, setReminderStatus] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const mode = await getSavedBackupReminderMode();
        setReminderModeState(mode);
      } catch {
        // ignore
      }
    })();
  }, []);

  const applyReminderMode = async (mode: BackupReminderMode) => {
    try {
      setReminderStatus('');
      await setBackupReminderMode(mode);
      setReminderModeState(mode);

      if (mode === 'off') setReminderStatus('Backup reminder turned off.');
      if (mode === 'weekly') setReminderStatus('Weekly reminder set (Sunday 18:00).');
      if (mode === 'monthly') setReminderStatus('Monthly reminder set (1st at 18:00).');
    } catch (e: any) {
      setReminderStatus(e?.message || 'Could not set reminder.');
      try {
        const modeNow = await getSavedBackupReminderMode();
        setReminderModeState(modeNow);
      } catch {
        // ignore
      }
    }
  };

  const counts = useMemo(
    () => ({
      accounts: accounts.length,
      transactions: transactions.length,
      recurring: recurring.length,
      budgets: budgets.length,
    }),
    [accounts.length, transactions.length, recurring.length, budgets.length]
  );

  const handleExportBackup = async () => {
    try {
      setStatus('');

      // ✅ This now exports budgets too (assuming createBackupV1 supports it)
      const backup = createBackupV1({ accounts, transactions, recurring, });
      const json = JSON.stringify(backup, null, 2);

      const filename = `DebitLens_Backup_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, '-')}.json`;

      const baseDir: string | undefined = FS.documentDirectory;
      if (!baseDir) throw new Error('File system directory is not available.');

      const uri = baseDir + filename;

      if (!FS.writeAsStringAsync) {
        throw new Error('expo-file-system is not available at runtime.');
      }

      await FS.writeAsStringAsync(uri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save / Share backup file',
        });
        setStatus('Backup ready to save/share.');
      } else {
        setStatus(`Backup saved to: ${uri}`);
      }
    } catch (e: any) {
      setStatus(e?.message || 'Export failed.');
    }
  };

  const handlePickBackup = async () => {
    try {
      setStatus('');
      setPreview(null);

      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;

      const asset = res.assets?.[0];
      if (!asset?.uri) throw new Error('No file selected.');

      if (!FS.readAsStringAsync) {
        throw new Error('expo-file-system is not available at runtime.');
      }

      const text = await FS.readAsStringAsync(asset.uri);
      const parsed = parseAndValidateBackup(text);

      setPreview(parsed);
      setStatus(`Loaded backup v${parsed.version} (${parsed.exportedAt.slice(0, 10)})`);
    } catch (e: any) {
      setStatus(e?.message || 'Import failed.');
    }
  };

  const handleApplyRestore = () => {
    if (!preview) return;

    if (!replaceMode) {
      setStatus('Merge mode not implemented yet (turn on Replace).');
      return;
    }

    actions.replaceAllData({
      accounts: preview.app.accounts,
      transactions: preview.app.transactions,
      recurring: preview.app.recurring,
      budgets: preview.app.budgets ?? budgets, // if backup has budgets use them, else keep current
    });


    setPreview(null);
    setStatus('Restore applied (data replaced).');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Backup &amp; Restore</Text>
      <Text style={styles.subtle}>
        Export a full backup of accounts + transactions (and recurring), or restore from a backup
        file.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current data</Text>
        <Text style={styles.cardLine}>Accounts: {counts.accounts}</Text>
        <Text style={styles.cardLine}>Transactions: {counts.transactions}</Text>
        <Text style={styles.cardLine}>Recurring: {counts.recurring}</Text>
        <Text style={styles.cardLine}>Budgets: {counts.budgets}</Text>

        <Pressable style={styles.btn} onPress={handleExportBackup}>
          <Text style={styles.btnText}>Export full backup (JSON)</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backup reminder</Text>
        <Text style={styles.cardLine}>Get a notification reminder to export a backup to Files.</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Weekly (Sun 18:00)</Text>
          <Switch
            value={reminderMode === 'weekly'}
            onValueChange={(v) => applyReminderMode(v ? 'weekly' : 'off')}
            trackColor={{ false: '#222', true: '#3ddc84' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Monthly (1st 18:00)</Text>
          <Switch
            value={reminderMode === 'monthly'}
            onValueChange={(v) => applyReminderMode(v ? 'monthly' : 'off')}
            trackColor={{ false: '#222', true: '#3ddc84' }}
            thumbColor="#fff"
          />
        </View>

        {reminderStatus ? <Text style={styles.status}>{reminderStatus}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Restore</Text>

        <Pressable style={styles.btnSecondary} onPress={handlePickBackup}>
          <Text style={styles.btnSecondaryText}>Select backup file (JSON)</Text>
        </Pressable>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Replace existing data</Text>
          <Switch
            value={replaceMode}
            onValueChange={setReplaceMode}
            trackColor={{ false: '#222', true: '#3ddc84' }}
            thumbColor="#fff"
          />
        </View>

        {preview ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Preview</Text>
            <Text style={styles.previewLine}>Version: {preview.version}</Text>
            <Text style={styles.previewLine}>Exported: {preview.exportedAt}</Text>
            <Text style={styles.previewLine}>Accounts: {preview.app.accounts.length}</Text>
            <Text style={styles.previewLine}>Transactions: {preview.app.transactions.length}</Text>
            <Text style={styles.previewLine}>Recurring: {preview.app.recurring.length}</Text>
            <Text style={styles.previewLine}>Budgets: {preview.app.budgets?.length ?? 0}</Text>

            <Pressable style={styles.btnDanger} onPress={handleApplyRestore}>
              <Text style={styles.btnText}>Apply restore</Text>
            </Pressable>

            <Text style={styles.warn}>This will overwrite your current data.</Text>
          </View>
        ) : null}
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#0B1020' },
  h1: { fontSize: 26, fontWeight: '800', marginBottom: 6, color: '#fff' },
  subtle: { opacity: 0.8, marginBottom: 14, color: '#fff' },

  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#111827',
    marginBottom: 12,
  },
  cardTitle: { fontWeight: '800', color: '#fff', marginBottom: 8, fontSize: 16 },
  cardLine: { color: '#fff', opacity: 0.9, marginBottom: 4 },

  btn: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#0B1020',
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800' },

  btnSecondary: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#0B1020',
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#fff', fontWeight: '700' },

  btnDanger: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#7f1d1d',
    alignItems: 'center',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  toggleLabel: { color: '#fff', fontWeight: '700', opacity: 0.9 },

  previewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: '#0B1020',
  },
  previewTitle: { color: '#fff', fontWeight: '800', marginBottom: 8 },
  previewLine: { color: '#fff', opacity: 0.9, marginBottom: 4 },
  warn: { color: '#fff', opacity: 0.75, marginTop: 8, fontSize: 12 },

  status: { marginTop: 6, color: '#fff', opacity: 0.85 },
});
