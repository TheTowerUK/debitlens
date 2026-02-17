// src/screens/DataImportScreen.tsx
import React, { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';
import { useDataExportImport } from '../hooks/useDataExportImport';

type Props = NativeStackScreenProps<RootStackParamList, 'DataImport'>;

const MAX_CSV_IMPORT_ROWS = 200;

export default function DataImportScreen(_props: Props) {
  const d = useDataExportImport();
  useEffect(() => {
    return () => d.onBlurCleanupImport();
  }, [d.onBlurCleanupImport]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Data import &amp; restore</Text>
      <Text style={styles.subtle}>
        Restore from a JSON backup or import/restore transactions from CSV.
      </Text>

      {/* Pending import banner at top */}
      {d.pendingActive ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerTitle}>Pending import</Text>
          <Text style={styles.pendingBannerText}>
            Pending transactions: {d.pendingTxs.length}
          </Text>
          <Text style={styles.pendingBannerText}>
            Progress: {Math.min(d.importBatchOffset, d.importTotalDataRows)} / {d.importTotalDataRows}
          </Text>
          <View style={styles.pendingBannerButtons}>
            <Pressable
              style={[styles.btnPrimary, styles.pendingBannerBtn, (!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active) && styles.btnPrimaryDisabled]}
              onPress={d.handleCommitPendingImport}
              disabled={!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active}
            >
              <Text style={[styles.btnPrimaryText, (!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active) && styles.btnPrimaryTextDisabled]}>
                Commit
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btnSecondaryFull, styles.pendingBannerBtn, (!d.pendingActive || d.progress.active) && styles.btnSecondaryDisabled]}
              onPress={d.handleDiscardPendingImport}
              disabled={!d.pendingActive || d.progress.active}
            >
              <Text style={[styles.btnSecondaryText, (!d.pendingActive || d.progress.active) && styles.btnSecondaryTextDisabled]}>
                Discard
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* JSON BACKUP RESTORE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>JSON backup (restore)</Text>
        <Text style={styles.sectionText}>
          Select a JSON backup file to restore. Choose Replace (full) or Merge (add new only).
        </Text>

        <Pressable style={styles.btnSecondaryFull} onPress={d.handlePickJsonBackup}>
          <Text style={styles.btnSecondaryText}>Select JSON backup to restore</Text>
        </Pressable>

        {d.jsonPreview ? (
          <View style={styles.optionsBox}>
            <Text style={styles.optionsTitle}>Restore mode</Text>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>
                {d.jsonRestoreMode === 'replace' ? 'Replace (full restore)' : 'Merge (add new only)'}
              </Text>
              <Switch
                value={d.jsonRestoreMode === 'replace'}
                onValueChange={(v) => d.setJsonRestoreMode(v ? 'replace' : 'merge')}
              />
            </View>

            <Text style={styles.hint}>
              Replace wipes current data first. Merge keeps current data and adds only new IDs.
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.btnSecondaryFull, !d.jsonPreview && styles.btnSecondaryDisabled]}
          onPress={() => d.setShowPreview((v) => !v)}
          disabled={!d.jsonPreview}
        >
          <Text style={[styles.btnPrimaryText, !d.jsonPreview && styles.btnSecondaryTextDisabled]}>
            {d.showPreview ? 'Hide preview' : 'Show preview'}
          </Text>
        </Pressable>

        {d.showPreview && d.jsonPreview ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>JSON preview</Text>
            <Text style={styles.previewMeta}>Exported: {d.jsonPreview.exportedAt}</Text>
            <Text style={styles.statLine}>Accounts: {d.jsonPreview.app.accounts.length}</Text>
            <Text style={styles.statLine}>Transactions: {d.jsonPreview.app.transactions.length}</Text>
            <Text style={styles.statLine}>Recurring: {d.jsonPreview.app.recurring.length}</Text>

            <Pressable style={styles.btnDestructive} onPress={d.handleApplyJsonRestore}>
              <Text style={styles.btnDestructiveText}>Apply JSON restore ({d.jsonRestoreMode})</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* CSV IMPORT / RESTORE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CSV import / restore</Text>
        <Text style={styles.sectionText}>
          CSV import is limited to {MAX_CSV_IMPORT_ROWS} rows per batch for stability. If your file has more rows, use Continue import to import the next batch. Pick a CSV file, then import (append) or restore (replace/merge).
        </Text>

        <Text style={styles.subtle}>
          Note: DebitLens imports <Text style={styles.bold}>CSV</Text> files. If you have an Excel file (.xlsx), export or
          "Save As" <Text style={styles.bold}>CSV (Comma delimited)</Text> first.
        </Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Create missing accounts from CSV</Text>
          <Switch value={d.createMissingAccounts} onValueChange={d.setCreateMissingAccounts} />
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>
            CSV restore mode: {d.csvRestoreMode === 'replace' ? 'Replace' : 'Merge'}
          </Text>
          <Switch value={d.csvRestoreMode === 'merge'} onValueChange={(v) => d.setCsvRestoreMode(v ? 'merge' : 'replace')} />
        </View>

        <View style={styles.optionsBox}>
          <Text style={styles.optionsTitle}>Recurring rebuild mode</Text>
          <View style={styles.rowButtons}>
            <Pressable
              style={[
                styles.btnSecondary,
                d.recurringRebuildMode === 'none' && styles.btnSecondaryActive,
              ]}
              onPress={() => d.setRecurringRebuildMode('none')}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  d.recurringRebuildMode === 'none' && styles.btnSecondaryTextActive,
                ]}
              >
                None
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnSecondary,
                d.recurringRebuildMode === 'last18Months' && styles.btnSecondaryActive,
              ]}
              onPress={() => d.setRecurringRebuildMode('last18Months')}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  d.recurringRebuildMode === 'last18Months' && styles.btnSecondaryTextActive,
                ]}
              >
                18mo
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.btnSecondary,
                d.recurringRebuildMode === 'all' && styles.btnSecondaryActive,
              ]}
              onPress={() => d.setRecurringRebuildMode('all')}
            >
              <Text
                style={[
                  styles.btnSecondaryText,
                  d.recurringRebuildMode === 'all' && styles.btnSecondaryTextActive,
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
          <Pressable style={styles.btnSecondary} onPress={d.handlePickCsvFile}>
            <Text style={styles.btnSecondaryText}>Pick CSV file</Text>
          </Pressable>

          <Pressable style={styles.btnDestructive} onPress={d.handleApplyCsvRestore}>
            <Text style={styles.btnDestructiveText}>
              {d.csvRestoreMode === 'replace' ? 'Restore from CSV' : 'Merge CSV into data'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.btnSecondaryFull, !d.importCsvText.trim() && styles.btnSecondaryDisabled]}
          onPress={() => d.setShowCsvPreview((v) => !v)}
          disabled={!d.importCsvText.trim()}
        >
          <Text style={[styles.btnPrimaryText, !d.importCsvText.trim() && styles.btnSecondaryTextDisabled]}>
            {d.showCsvPreview ? 'Hide preview' : 'Show preview'}
          </Text>
        </Pressable>

        {d.showCsvPreview && d.importCsvText.trim() ? (
          <View style={styles.previewBox}>
            <Text style={styles.sectionTitle}>CSV preview</Text>
            <ScrollView style={styles.csvPreviewScroll} nestedScrollEnabled>
              <Text selectable style={styles.csvPreviewText}>
                {(() => {
                  const lines = d.importCsvText.split(/\r?\n/);
                  const maxLines = 100;
                  const truncated = lines.length > maxLines;
                  const previewContent = truncated ? lines.slice(0, maxLines).join('\n') : d.importCsvText;
                  return truncated ? `${previewContent}\n\n… truncated (${lines.length} total lines)` : previewContent;
                })()}
              </Text>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.rowButtons}>
          <Pressable
            style={[styles.btnDestructive, d.progress.active && styles.btnPrimaryDisabled]}
            onPress={d.handleApplyCsvImportPress}
            disabled={d.progress.active}
          >
            <Text style={[styles.btnDestructiveText, d.progress.active && styles.btnPrimaryTextDisabled]}>
              Apply CSV import
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.btnSecondaryFull, (!d.importCsvText.trim() || !d.importHasMoreBatches) && styles.btnSecondaryDisabled]}
          onPress={d.handleContinueCsvImportPress}
          disabled={!d.importCsvText.trim() || !d.importHasMoreBatches || d.progress.active}
        >
          <Text style={[styles.btnSecondaryText, (!d.importCsvText.trim() || !d.importHasMoreBatches) && styles.btnSecondaryTextDisabled]}>
            Continue import (next {MAX_CSV_IMPORT_ROWS})
          </Text>
        </Pressable>

        {d.pendingActive ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Pending import</Text>
            <Text style={styles.statusText}>
              Pending transactions: {d.pendingTxs.length}
            </Text>
            <Text style={styles.statusText}>
              Progress: {Math.min(d.importBatchOffset, d.importTotalDataRows)} / {d.importTotalDataRows}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.btnPrimary, (!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active) && styles.btnPrimaryDisabled]}
          onPress={d.handleCommitPendingImport}
          disabled={!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active}
        >
          <Text style={[styles.btnPrimaryText, (!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active) && styles.btnPrimaryTextDisabled]}>
            Commit import (save to app)
          </Text>
        </Pressable>

        <Pressable
          style={[styles.btnSecondaryFull, (!d.pendingActive || d.progress.active) && styles.btnSecondaryDisabled]}
          onPress={d.handleDiscardPendingImport}
          disabled={!d.pendingActive || d.progress.active}
        >
          <Text style={[styles.btnSecondaryText, (!d.pendingActive || d.progress.active) && styles.btnSecondaryTextDisabled]}>
            Discard pending import
          </Text>
        </Pressable>

        {d.importCsvText.trim() ? (
          <Text style={styles.hint}>
            File: {d.importLastFilename || 'selected CSV'} • Imported: {Math.min(d.importBatchOffset, d.importTotalDataRows)} / {d.importTotalDataRows || '…'}
          </Text>
        ) : null}

        <Pressable
          style={[styles.btnSecondaryFull, !d.txs.length && styles.btnSecondaryDisabled]}
          onPress={d.handleRebuildRecurringNow}
          disabled={!d.txs.length}
        >
          <Text style={[styles.btnSecondaryText, !d.txs.length && styles.btnSecondaryTextDisabled]}>
            Rebuild recurring now (uses selected mode)
          </Text>
        </Pressable>

        <Text style={styles.hint}>
          Rebuild recurring is optional and can be slow on large datasets. Use "Last 18 months" for best performance.
        </Text>

        {(d.progress.stage !== 'idle' && (d.progress.message || d.progress.active)) ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>
              {d.progress.active ? 'Working…' : d.progress.stage === 'error' ? 'Failed' : 'Done'}
            </Text>
            <Text style={styles.progressText}>
              {d.progress.message}
            </Text>
            <Text style={styles.progressMeta}>
              Stage: {d.progress.stage} • Elapsed: {d.progressElapsedSec}s
            </Text>
            {(d.progress.parsedRows || d.progress.toImport || d.progress.imported || d.progress.skipped) ? (
              <Text style={styles.progressMeta}>
                Parsed: {d.progress.parsedRows ?? 0} • To import: {d.progress.toImport ?? 0} • Imported: {d.progress.imported ?? 0} • Skipped: {d.progress.skipped ?? 0}
              </Text>
            ) : null}
          </View>
        ) : null}

        {d.lastCsvStats ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>
              Last CSV {d.lastCsvStats.operation === 'restore' ? 'restore' : 'import'} (persisted)
            </Text>
            <Text style={styles.statusText}>
              {new Date(d.lastCsvStats.finishedAt).toLocaleString()} ({d.lastCsvStats.source}
              {d.lastCsvStats.mode ? ` • ${d.lastCsvStats.mode}` : ''})
            </Text>
            <Text style={styles.statusText}>Imported: {d.lastCsvStats.importedCount}</Text>
            <Text style={styles.statusText}>Accounts created: {d.lastCsvStats.createdAccountsCount}</Text>
            <Text style={styles.statusText}>Skipped unknown: {d.lastCsvStats.skippedUnknownAccount}</Text>
            <Text style={styles.statusText}>Bad amount/date: {d.lastCsvStats.skippedBadAmountOrDate}</Text>
            <Text style={styles.statusText}>Missing account: {d.lastCsvStats.skippedMissingAccountName}</Text>
          </View>
        ) : null}

        {d.lastStatus ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusText}>{d.lastStatus}</Text>
          </View>
        ) : null}

        {d.lastImportSummary ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Summary</Text>
            <Text style={styles.statusText}>{d.lastImportSummary}</Text>
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

  pendingBanner: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pendingBannerTitle: { color: 'white', fontWeight: '700', fontSize: 16, marginBottom: 6 },
  pendingBannerText: { color: '#E5E7EB', marginTop: 2 },
  pendingBannerButtons: { flexDirection: 'row', marginTop: 10, gap: 8 },
  pendingBannerBtn: { flex: 1, marginTop: 0 },

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
});
