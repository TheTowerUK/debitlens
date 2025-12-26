// src/screens/ReportEditorScreen.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { getReport, saveReport, saveReportFromDefinition, ReportFilter, ReportRow } from '../services/reporting';
import { colors as theme } from '../theme/colors';

// Props: navigator props plus an executor for DB queries and either a saved report definition
// or an in-memory set of rows. Adapt the injection of `executor` to your app (context/hook).
type NavProps = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type ReportDefinition = {
  id: string;
  name?: string;
  type?: string;
  params?: ReportFilter;
  createdAt?: string;
  updatedAt?: string;
};

type Props = NavProps & {
  // DB executor used by getReport/saveReportFromDefinition:
  executor: (sql: string, args?: any[]) => Promise<any[]>;
  // either a saved report definition (template) or the rows to export
  reportDef?: ReportDefinition;
  rows?: ReportRow[];
};

export default function ReportEditorScreen({ navigation, executor, reportDef, rows }: Props) {
  const [busy, setBusy] = useState(false);

  const onExportFromDefinition = async () => {
    if (!reportDef) {
      Alert.alert('No report definition', 'There is no saved report to export.');
      return;
    }
    setBusy(true);
    try {
      // uses the convenience adapter added to reporting.ts
      const res = await saveReportFromDefinition(executor, reportDef, { writeToFile: true });
      Alert.alert('Exported', res.writtenPath ? `Saved to ${res.writtenPath}` : 'CSV generated');
    } catch (err: any) {
      console.warn('Export failed', err);
      Alert.alert('Export failed', err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const onExportRows = async () => {
    const sourceRows = rows;
    if (!sourceRows || !sourceRows.length) {
      Alert.alert('No rows', 'There are no rows to export. Run the report first.');
      return;
    }
    setBusy(true);
    try {
      const res = await saveReport(sourceRows, { writeToFile: true });
      Alert.alert('Exported', res.writtenPath ? `Saved to ${res.writtenPath}` : 'CSV generated');
    } catch (err: any) {
      console.warn('Export rows failed', err);
      Alert.alert('Export failed', err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const onRunAndExport = async () => {
    // If user supplied a reportDef with params but you want to run then export in one action
    if (!reportDef?.params) {
      Alert.alert('Missing params', 'Report definition does not contain params to run the report.');
      return;
    }
    setBusy(true);
    try {
      const rows = await getReport(executor, reportDef.params);
      const res = await saveReport(rows, { writeToFile: true });
      Alert.alert('Exported', res.writtenPath ? `Saved to ${res.writtenPath}` : 'CSV generated');
    } catch (err: any) {
      console.warn('Run & export failed', err);
      Alert.alert('Export failed', err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Report Editor</Text>

      <Pressable style={styles.button} onPress={onExportFromDefinition} disabled={busy || !reportDef}>
        <Text style={styles.buttonText}>{busy ? 'Working…' : 'Export saved report'}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={onRunAndExport} disabled={busy || !reportDef?.params}>
        <Text style={styles.buttonText}>{busy ? 'Working…' : 'Run report and export'}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={onExportRows} disabled={busy || !rows?.length}>
        <Text style={styles.buttonText}>{busy ? 'Working…' : 'Export current rows'}</Text>
      </Pressable>

      <Pressable style={styles.ghost} onPress={() => navigation.goBack()} disabled={busy}>
        <Text style={styles.ghostText}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 40, backgroundColor: '#0B0D13' },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 20 },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  ghost: {
    backgroundColor: theme.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  ghostText: { color: '#E5E7EB', fontWeight: '700' },
});
