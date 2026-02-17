// src/screens/DataExportScreen.tsx
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

type Props = NativeStackScreenProps<RootStackParamList, 'DataExport'>;

export default function DataExportScreen(_props: Props) {
  const d = useDataExportImport();
  useEffect(() => {
    return () => d.onBlurCleanupExport();
  }, [d.onBlurCleanupExport]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Data export</Text>
      <Text style={styles.subtle}>
        Export JSON backup or CSV (template or transactions) to Files.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current data snapshot</Text>
        <Text style={styles.statLine}>Accounts: {d.accounts.length}</Text>
        <Text style={styles.statLine}>Transactions: {d.txs.length}</Text>
        <Text style={styles.statLine}>Recurring: {d.recurring.length}</Text>
        <Text style={styles.statLine}>Budgets: {d.budgets.length}</Text>
      </View>

      {/* JSON BACKUP EXPORT */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>JSON backup (export)</Text>
        <Text style={styles.sectionText}>
          Export a full backup or an empty template to Files.
        </Text>

        <Pressable style={styles.btnPrimary} onPress={d.handleExportJsonFile}>
          <Text style={styles.btnPrimaryText}>Export full backup as JSON (Files)</Text>
        </Pressable>

        <Pressable style={styles.btnSecondaryFull} onPress={d.handleExportJsonTemplateFile}>
          <Text style={styles.btnSecondaryText}>Export empty JSON template (Files)</Text>
        </Pressable>
      </View>

      {/* CSV TEMPLATE */}
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
          If you see "Missing required columns: Account A or Account B", your CSV header row must include at least one of those columns.
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
            <Text style={[styles.sectionText, { marginBottom: 6 }]}>
              Copy this format into your own spreadsheet, then save as CSV.
            </Text>
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

  previewBox: {
    marginTop: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: theme.border,
  },
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
