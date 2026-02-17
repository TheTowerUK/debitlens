// src/screens/DataTransferScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors as theme } from '../theme/colors';
import { useDataExportImport } from '../hooks/useDataExportImport';

type Tab = 'export' | 'import';
type ImportStep = 'pick' | 'review' | 'commit';

const MAX_CSV_IMPORT_ROWS = 200;

export default function DataTransferScreen() {
  const d = useDataExportImport();

  const [tab, setTab] = useState<Tab>('export');
  const [step, setStep] = useState<ImportStep>('pick');

  useEffect(() => {
    return () => d.onBlurCleanup();
  }, [d.onBlurCleanup]);

  // Step transitions: commit > review > pick
  useEffect(() => {
    if (d.pendingActive || d.pendingTxs.length > 0) {
      setStep('commit');
    } else if (d.importCsvText?.trim?.().length > 0) {
      setStep('review');
    } else {
      setStep('pick');
    }
  }, [d.importCsvText, d.pendingActive, d.pendingTxs.length]);

  const stepLabel = useMemo(() => {
    if (step === 'pick') return 'Pick';
    if (step === 'review') return 'Review';
    return 'Commit';
  }, [step]);

  const stepIndex = useMemo(() => {
    if (step === 'commit') return 2;
    if (step === 'review') return 1;
    return 0;
  }, [step]);

  const stepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = stepIndex / 2; // 0, 0.5, 1
    Animated.timing(stepAnim, {
      toValue: target,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation
    }).start();
  }, [stepIndex, stepAnim]);

  return (
    <>
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Import / Export</Text>
      <Text style={styles.subtle}>Manage your DebitLens data in one place.</Text>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentBtn, tab === 'export' && styles.segmentBtnActive]}
          onPress={() => setTab('export')}
        >
          <Text style={[styles.segmentText, tab === 'export' && styles.segmentTextActive]}>
            Export
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, tab === 'import' && styles.segmentBtnActive]}
          onPress={() => setTab('import')}
        >
          <Text style={[styles.segmentText, tab === 'import' && styles.segmentTextActive]}>
            Import
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current data snapshot</Text>
        <Text style={styles.statLine}>Accounts: {d.accounts.length}</Text>
        <Text style={styles.statLine}>Transactions: {d.txs.length}</Text>
        <Text style={styles.statLine}>Recurring: {d.recurring.length}</Text>
        <Text style={styles.statLine}>Budgets: {d.budgets.length}</Text>
      </View>

      {tab === 'export' ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>JSON backup (export / restore)</Text>
            <Text style={styles.sectionText}>
              Export a full backup to Files and restore it later. Restore supports Replace or Merge.
            </Text>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Encrypt JSON backup (passcode)</Text>
              <Switch value={d.jsonEncryptEnabled} onValueChange={d.setJsonEncryptEnabled} />
            </View>
            <Text style={styles.hint}>
              Opt-in. If you forget the passcode, the backup cannot be restored.
            </Text>

            <Pressable style={styles.btnPrimary} onPress={d.handleExportJsonFile}>
              <Text style={styles.btnPrimaryText}>Export full backup as JSON (Files)</Text>
            </Pressable>

            <Pressable style={styles.btnSecondaryFull} onPress={d.handleExportJsonTemplateFile}>
              <Text style={styles.btnSecondaryText}>Export empty JSON template (Files)</Text>
            </Pressable>

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

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CSV Template (Import Format)</Text>
            <Text style={styles.sectionText}>
              Use this template to format transactions for importing into DebitLens.
            </Text>
            <Text style={styles.sectionText}>
              Required columns: Date, Amount, Description, Category, Type, and Account A or Account B (at least one).
            </Text>

            <Pressable
              style={styles.btnSecondaryFull}
              onPress={() => d.setShowTemplatePreview((v) => !v)}
            >
              <Text style={[styles.btnPrimaryText, d.showTemplatePreview && styles.btnSecondaryTextActive]}>
                {d.showTemplatePreview ? 'Hide preview' : 'Show preview'}
              </Text>
            </Pressable>

            {d.showTemplatePreview ? (
              <View style={styles.previewBox}>
                <Text style={styles.sectionTitle}>Preview (read-only):</Text>
                <ScrollView style={styles.csvPreviewScroll} nestedScrollEnabled>
                  <Text selectable style={styles.csvPreviewText}>
                    {d.templateCsvText}
                  </Text>
                </ScrollView>
              </View>
            ) : null}

            <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={d.handleExportCsvPreview}>
              <Text style={styles.btnPrimaryText}>Export Template CSV (Files)</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Export Transactions</Text>
            <Text style={styles.sectionText}>
              Generate and export your transactions as CSV to Files.
            </Text>

            <View style={styles.optionsBox}>
              <Text style={styles.optionsTitle}>Transactions CSV export options</Text>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Include description</Text>
                <Switch value={d.csvIncludeDescription} onValueChange={d.setCsvIncludeDescription} />
              </View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>Use account name (vs accountId)</Text>
                <Switch value={d.csvIncludeAccountName} onValueChange={d.setCsvIncludeAccountName} />
              </View>
            </View>

            <Pressable
              style={[styles.btnSecondaryFull, d.isTransactionsCsvGenerated && styles.btnSecondaryActive]}
              onPress={d.handleGenerateCsv}
            >
              <Text style={[styles.btnSecondaryText, d.isTransactionsCsvGenerated && styles.btnSecondaryTextActive]}>
                {d.isTransactionsCsvGenerated ? '✓ Transactions CSV Generated' : 'Generate Transactions CSV (text)'}
              </Text>
            </Pressable>

            {d.isTransactionsCsvGenerated && (
              <Text style={styles.statusHint}>Transactions CSV generated. Ready to export.</Text>
            )}

            <Pressable
              style={[styles.btnSecondaryFull, !d.exportCsvText.trim() && styles.btnSecondaryDisabled]}
              onPress={() => d.setShowExportPreview((v) => !v)}
              disabled={!d.exportCsvText.trim()}
            >
              <Text style={[styles.btnPrimaryText, !d.exportCsvText.trim() && styles.btnSecondaryTextDisabled]}>
                {d.showExportPreview ? 'Hide preview' : 'Show preview'}
              </Text>
            </Pressable>

            {d.showExportPreview && d.exportCsvText.trim() ? (
              <View style={styles.previewBox}>
                <Text style={styles.sectionTitle}>Transactions CSV preview</Text>
                <ScrollView style={styles.csvPreviewScroll} nestedScrollEnabled>
                  <Text selectable style={styles.csvPreviewText}>
                    {(() => {
                      const lines = d.exportCsvText.split(/\r?\n/);
                      const maxLines = 100;
                      const truncated = lines.length > maxLines;
                      const previewContent = truncated ? lines.slice(0, maxLines).join('\n') : d.exportCsvText;
                      return truncated ? `${previewContent}\n\n… truncated (${lines.length} total lines)` : previewContent;
                    })()}
                  </Text>
                </ScrollView>
              </View>
            ) : null}

            <Pressable
              style={[styles.btnPrimary, !d.isTransactionsCsvGenerated && styles.btnPrimaryDisabled]}
              onPress={d.handleExportCsvFile}
              disabled={!d.isTransactionsCsvGenerated}
            >
              <Text style={[styles.btnPrimaryText, !d.isTransactionsCsvGenerated && styles.btnPrimaryTextDisabled]}>
                Export Transactions CSV (Files)
              </Text>
            </Pressable>
          </View>

          {d.lastStatus ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusText}>{d.lastStatus}</Text>
            </View>
          ) : null}
        </>
      ) : null}

      {tab === 'import' ? (
        <>
          <View style={styles.stepRow}>
            <View style={[styles.stepPill, step === 'pick' && styles.stepPillActive]}>
              <Text style={[styles.stepText, step === 'pick' && styles.stepTextActive]}>1 Pick</Text>
            </View>
            <View style={[styles.stepPill, step === 'review' && styles.stepPillActive]}>
              <Text style={[styles.stepText, step === 'review' && styles.stepTextActive]}>2 Review</Text>
            </View>
            <View style={[styles.stepPill, step === 'commit' && styles.stepPillActive]}>
              <Text style={[styles.stepText, step === 'commit' && styles.stepTextActive]}>3 Commit</Text>
            </View>
          </View>

          <View style={styles.stepProgressWrap}>
            <View style={styles.stepTrack} />
            <Animated.View
              style={[
                styles.stepFill,
                {
                  width: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
            <View style={styles.stepNodesRow} pointerEvents="none">
              <View style={styles.stepNode}>
                <View style={[styles.dot, stepIndex >= 0 ? styles.dotActive : styles.dotInactive]} />
                <Text style={[styles.stepLabel, stepIndex >= 0 ? styles.stepLabelActive : styles.stepLabelInactive]}>
                  Pick
                </Text>
              </View>
              <View style={styles.stepNode}>
                <View style={[styles.dot, stepIndex >= 1 ? styles.dotActive : styles.dotInactive]} />
                <Text style={[styles.stepLabel, stepIndex >= 1 ? styles.stepLabelActive : styles.stepLabelInactive]}>
                  Review
                </Text>
              </View>
              <View style={styles.stepNode}>
                <View style={[styles.dot, stepIndex >= 2 ? styles.dotActive : styles.dotInactive]} />
                <Text style={[styles.stepLabel, stepIndex >= 2 ? styles.stepLabelActive : styles.stepLabelInactive]}>
                  Commit
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CSV import</Text>
            <Text style={styles.sectionText}>
              Step: <Text style={styles.bold}>{stepLabel}</Text> • Import runs in batches of {MAX_CSV_IMPORT_ROWS} rows.
            </Text>

            <Text style={styles.subtle}>
              DebitLens imports <Text style={styles.bold}>CSV</Text> files. If you have Excel (.xlsx), export as CSV first.
            </Text>

            {step === 'pick' ? (
              <>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Create missing accounts from CSV</Text>
                  <Switch value={d.createMissingAccounts} onValueChange={d.setCreateMissingAccounts} />
                </View>
                <View style={styles.optionsBox}>
                  <Text style={styles.optionsTitle}>Recurring rebuild mode</Text>
                  <View style={styles.rowButtons}>
                    <Pressable
                      style={[styles.btnSecondary, d.recurringRebuildMode === 'none' && styles.btnSecondaryActive]}
                      onPress={() => d.setRecurringRebuildMode('none')}
                    >
                      <Text style={[styles.btnSecondaryText, d.recurringRebuildMode === 'none' && styles.btnSecondaryTextActive]}>None</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnSecondary, d.recurringRebuildMode === 'last18Months' && styles.btnSecondaryActive]}
                      onPress={() => d.setRecurringRebuildMode('last18Months')}
                    >
                      <Text style={[styles.btnSecondaryText, d.recurringRebuildMode === 'last18Months' && styles.btnSecondaryTextActive]}>18mo</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btnSecondary, d.recurringRebuildMode === 'all' && styles.btnSecondaryActive]}
                      onPress={() => d.setRecurringRebuildMode('all')}
                    >
                      <Text style={[styles.btnSecondaryText, d.recurringRebuildMode === 'all' && styles.btnSecondaryTextActive]}>All</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.hint}>Rebuild scope: None, Last 18 months (recommended), or All (slow).</Text>
                </View>

                <Pressable style={styles.btnSecondaryFull} onPress={d.handlePickCsvFile}>
                  <Text style={styles.btnSecondaryText}>Pick CSV file</Text>
                </Pressable>
                {d.importLastFilename ? (
                  <Text style={styles.hint}>File: {d.importLastFilename}</Text>
                ) : null}
              </>
            ) : null}

            {step === 'review' ? (
              <>
                <Text style={styles.hint}>
                  File: {d.importLastFilename || 'selected CSV'} • Rows: {d.importTotalDataRows ?? '…'}
                </Text>

                <View style={styles.optionsBox}>
                  <View style={styles.optionRow}>
                    <Text style={styles.optionsTitle}>Import validation summary</Text>
                    <Pressable
                      style={[styles.btnSecondary, { marginTop: 0, marginRight: 0, flex: 0 }]}
                      onPress={d.runCsvValidationSummary}
                      disabled={d.csvValidationRunning}
                    >
                      <Text style={styles.btnSecondaryText}>
                        {d.csvValidationRunning ? 'Checking…' : 'Recheck'}
                      </Text>
                    </Pressable>
                  </View>

                  {d.csvValidationSummary ? (
                    <>
                      <Text style={styles.statLine}>Rows: {d.csvValidationSummary.totalRows}</Text>
                      <Text style={styles.statLine}>Likely valid: {d.csvValidationSummary.validRows}</Text>

                      <Text style={styles.hint}>
                        Invalid type: {d.csvValidationSummary.invalidType} • Bad amount: {d.csvValidationSummary.badAmount} • Bad date: {d.csvValidationSummary.badDate}
                      </Text>

                      <Text style={styles.hint}>
                        Missing A (expense): {d.csvValidationSummary.missingAccountAForExpense} • Missing B (income): {d.csvValidationSummary.missingAccountBForIncome}
                      </Text>

                      <Text style={styles.hint}>
                        Transfer missing A: {d.csvValidationSummary.missingAccountAForTransfer} • Transfer missing B: {d.csvValidationSummary.missingAccountBForTransfer}
                      </Text>

                      {!d.createMissingAccounts ? (
                        <Text style={styles.hint}>
                          Unknown accounts (will be skipped): {d.csvValidationSummary.unknownAccounts}
                        </Text>
                      ) : null}

                      <Text style={styles.hint}>
                        Duplicate estimate (first 200 rows): {d.csvValidationSummary.duplicatesEstimated}
                      </Text>

                      {d.csvValidationSummary.warnings?.length ? (
                        <View style={{ marginTop: 8 }}>
                          {d.csvValidationSummary.warnings.map((w: string, idx: number) => (
                            <Text key={`w-${idx}`} style={styles.subtle}>• {w}</Text>
                          ))}
                        </View>
                      ) : null}

                      <Text style={styles.hint}>
                        Checked: {new Date(d.csvValidationSummary.finishedAt).toLocaleString()}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.hint}>No validation summary yet.</Text>
                  )}
                </View>

                {d.csvValidationSummary && d.csvValidationSummary.validRows === 0 ? (
                  <Text style={[styles.subtle, { color: '#FCA5A5' }]}>
                    No rows look valid. Fix the CSV before importing.
                  </Text>
                ) : null}

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

                <Pressable
                  style={[styles.btnDestructive, d.progress.active && styles.btnPrimaryDisabled]}
                  onPress={d.handleApplyCsvImportPress}
                  disabled={d.progress.active}
                >
                  <Text style={[styles.btnDestructiveText, d.progress.active && styles.btnPrimaryTextDisabled]}>
                    Apply CSV import
                  </Text>
                </Pressable>

                <View style={styles.optionsBox}>
                  <Text style={styles.optionsTitle}>Advanced: Replace or merge entire transaction set</Text>
                  <View style={styles.optionRow}>
                    <Text style={styles.optionLabel}>
                      {d.csvRestoreMode === 'replace' ? 'Replace (wipe then load CSV)' : 'Merge (add CSV into existing)'}
                    </Text>
                    <Switch value={d.csvRestoreMode === 'merge'} onValueChange={(v) => d.setCsvRestoreMode(v ? 'merge' : 'replace')} />
                  </View>
                  <Pressable
                    style={[styles.btnSecondaryFull, d.progress.active && styles.btnSecondaryDisabled]}
                    onPress={d.handleApplyCsvRestore}
                    disabled={d.progress.active}
                  >
                    <Text style={[styles.btnSecondaryText, d.progress.active && styles.btnSecondaryTextDisabled]}>
                      {d.csvRestoreMode === 'replace' ? 'Restore from CSV' : 'Merge CSV into data'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {step === 'commit' ? (
              <>
                <View style={styles.statusBox}>
                  <Text style={styles.statusLabel}>Pending import</Text>
                  <Text style={styles.statusText}>Pending transactions: {d.pendingTxs.length}</Text>
                  <Text style={styles.statusText}>
                    Progress: {Math.min(d.importBatchOffset, d.importTotalDataRows)} / {d.importTotalDataRows}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.btnSecondaryFull,
                    (!d.importHasMoreBatches || d.progress.active) && styles.btnSecondaryDisabled,
                  ]}
                  onPress={d.handleContinueCsvImportPress}
                  disabled={!d.importHasMoreBatches || d.progress.active}
                >
                  <Text
                    style={[
                      styles.btnSecondaryText,
                      (!d.importHasMoreBatches || d.progress.active) && styles.btnSecondaryTextDisabled,
                    ]}
                  >
                    Continue import (next {MAX_CSV_IMPORT_ROWS})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.btnPrimary,
                    (!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active) && styles.btnPrimaryDisabled,
                  ]}
                  onPress={d.handleCommitPendingImport}
                  disabled={!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active}
                >
                  <Text
                    style={[
                      styles.btnPrimaryText,
                      (!d.pendingActive || d.pendingTxs.length === 0 || d.progress.active) && styles.btnPrimaryTextDisabled,
                    ]}
                  >
                    Commit import (save to app)
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.btnSecondaryFull,
                    (!d.pendingActive || d.progress.active) && styles.btnSecondaryDisabled,
                  ]}
                  onPress={d.handleDiscardPendingImport}
                  disabled={!d.pendingActive || d.progress.active}
                >
                  <Text
                    style={[
                      styles.btnSecondaryText,
                      (!d.pendingActive || d.progress.active) && styles.btnSecondaryTextDisabled,
                    ]}
                  >
                    Discard pending import
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.btnSecondaryFull, !d.txs.length && styles.btnSecondaryDisabled]}
                  onPress={d.handleRebuildRecurringNow}
                  disabled={!d.txs.length}
                >
                  <Text style={[styles.btnSecondaryText, !d.txs.length && styles.btnSecondaryTextDisabled]}>
                    Rebuild recurring now (uses selected mode)
                  </Text>
                </Pressable>
              </>
            ) : null}

            {(d.progress.stage !== 'idle' && (d.progress.message || d.progress.active)) ? (
              <View style={styles.progressBox}>
                <Text style={styles.progressTitle}>
                  {d.progress.active ? 'Working…' : d.progress.stage === 'error' ? 'Failed' : 'Done'}
                </Text>
                <Text style={styles.progressText}>{d.progress.message}</Text>
                <Text style={styles.progressMeta}>
                  Stage: {d.progress.stage} • Elapsed: {d.progressElapsedSec}s
                </Text>
                {(d.progress.parsedRows != null || d.progress.toImport != null || d.progress.imported != null || d.progress.skipped != null) ? (
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
        </>
      ) : null}
    </ScrollView>

    <Modal
      transparent
      visible={d.jsonPasscodeModalVisible}
      animationType="fade"
      onRequestClose={() => d.setJsonPasscodeModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {d.jsonPasscodeMode === 'export' ? 'Set passcode' : 'Enter passcode'}
          </Text>

          <Text style={styles.modalHint}>
            {d.jsonPasscodeMode === 'export'
              ? 'This will encrypt your JSON backup. You\'ll need this passcode to restore.'
              : 'Enter the passcode used to encrypt this backup.'}
          </Text>

          <TextInput
            value={d.jsonPasscode}
            onChangeText={d.setJsonPasscode}
            placeholder="Passcode"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            style={styles.modalInput}
          />

          {d.jsonPasscodeMode === 'export' ? (
            <TextInput
              value={d.jsonPasscodeConfirm}
              onChangeText={d.setJsonPasscodeConfirm}
              placeholder="Confirm passcode"
              placeholderTextColor="rgba(255,255,255,0.4)"
              secureTextEntry
              style={styles.modalInput}
            />
          ) : null}

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.btnSecondaryFull, { flex: 1, marginRight: 8 }]}
              onPress={() => d.setJsonPasscodeModalVisible(false)}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.btnPrimary, { flex: 1, marginTop: 0 }]}
              onPress={
                d.jsonPasscodeMode === 'export'
                  ? d.confirmEncryptedJsonExport
                  : d.confirmDecryptSelectedBackup
              }
            >
              <Text style={styles.btnPrimaryText}>
                {d.jsonPasscodeMode === 'export' ? 'Encrypt & Export' : 'Decrypt'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 32 },

  h1: { color: 'white', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtle: { color: theme.textDim, marginBottom: 16, marginTop: 6, lineHeight: 18 },
  bold: { fontWeight: '800', color: theme.text },

  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    overflow: 'hidden',
    marginBottom: 12,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: 'rgba(37, 99, 235, 0.18)' },
  segmentText: { color: theme.textDim, fontWeight: '700' },
  segmentTextActive: { color: '#93C5FD' },

  stepRow: { flexDirection: 'row', marginBottom: 12 },
  stepPill: {
    flex: 1,
    marginRight: 6,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  stepPillActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  stepText: { color: '#E5E7EB', fontWeight: '700', fontSize: 12 },
  stepTextActive: { color: '#93C5FD' },

  stepProgressWrap: {
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
    paddingTop: 2,
    paddingBottom: 8,
  },
  stepTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    position: 'absolute',
    left: 8,
    right: 8,
    top: 10,
  },
  stepFill: {
    height: 3,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    position: 'absolute',
    left: 8,
    top: 10,
  },
  stepNodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 0,
  },
  stepNode: {
    width: '33.33%',
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginBottom: 6,
    borderWidth: 2,
  },
  dotActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  dotInactive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(148, 163, 184, 0.5)',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: '#E5E7EB',
  },
  stepLabelInactive: {
    color: 'rgba(148, 163, 184, 0.75)',
  },

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
  btnPrimaryDisabled: { backgroundColor: '#374151', opacity: 0.5 },
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
  btnSecondaryActive: { borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)' },
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
    marginTop: 8,
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
  statusHint: { color: theme.textDim, fontSize: 12, marginTop: 4, marginBottom: 4, fontStyle: 'italic' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0B1220',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalHint: { color: 'rgba(255,255,255,0.65)', marginBottom: 12, lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 10,
  },
  modalButtons: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
});
