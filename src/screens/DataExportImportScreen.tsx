// src/screens/DataExportImportScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp, type Account, type Transaction, type RecurringItem, type Budget } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Data'>;

type ExportPayload = {
  version: 1;
  exportedAt: string;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: any[];
  recurring: RecurringItem[];
};

const DataExportImportScreen: React.FC<Props> = ({ navigation }) => {
  const { state, actions } = useApp();

  const [importText, setImportText] = useState('');
  const [lastStatus, setLastStatus] = useState<string>('');

  const summary = useMemo(
    () => ({
      accounts: state.accounts?.length ?? 0,
      transactions: state.transactions?.length ?? 0,
      budgets: state.budgets?.length ?? 0,
      recurring: state.recurring?.length ?? 0,
    }),
    [state.accounts, state.transactions, state.budgets, state.recurring]
  );

  const handleExportJSON = async () => {
    try {
      const payload: ExportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: state.accounts || [],
        transactions: state.transactions || [],
        budgets: state.budgets || [],
        categories: state.categories || [],
        recurring: state.recurring || [],
      };

      const json = JSON.stringify(payload, null, 2);

      await Share.share({
        title: 'Debit Lens export',
        message: json,
      });

      setLastStatus('Exported current data as JSON.');
    } catch (err) {
      console.error('Export error', err);
      Alert.alert('Export failed', 'Something went wrong while exporting data.');
    }
  };

  const handleImport = () => {
    if (!importText.trim()) {
      Alert.alert('Nothing to import', 'Paste exported JSON into the box first.');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(importText);
    } catch {
      Alert.alert('Invalid JSON', 'Could not parse the pasted text as JSON.');
      return;
    }

    // Support either direct shape or wrapped shape if we ever change format
    const candidate =
      parsed && parsed.version === 1 && parsed.accounts
        ? parsed
        : parsed.data || parsed.state || parsed;

    if (!candidate || typeof candidate !== 'object') {
      Alert.alert('Invalid format', 'JSON does not look like a Debit Lens export.');
      return;
    }

    const accounts = Array.isArray(candidate.accounts) ? candidate.accounts : undefined;
    const transactions = Array.isArray(candidate.transactions) ? candidate.transactions : undefined;
    const budgets = Array.isArray(candidate.budgets) ? candidate.budgets : undefined;
    const categories = Array.isArray(candidate.categories) ? candidate.categories : undefined;
    const recurring = Array.isArray(candidate.recurring) ? candidate.recurring : undefined;

    if (!accounts && !transactions && !budgets && !categories && !recurring) {
      Alert.alert(
        'Nothing to import',
        'Exported JSON does not contain any accounts, transactions, budgets, categories, or recurring items.'
      );
      return;
    }

    Alert.alert(
      'Confirm import',
      'This will replace any matching data sets (e.g. accounts, transactions) with the imported ones if they are present. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: () => {
            actions.importData({
              accounts,
              transactions,
              budgets,
              categories,
              recurring,
            });
            setLastStatus('Imported data from JSON.');
            Alert.alert('Import complete', 'Your data has been updated.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'} Back</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Export & Import</Text>
          <Text style={styles.subtle}>
            Backup your data or restore from a previous export.
          </Text>
        </View>
      </View>

      {/* Current data summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current data</Text>
        <Text style={styles.summaryLine}>
          Accounts: <Text style={styles.summaryValue}>{summary.accounts}</Text>
        </Text>
        <Text style={styles.summaryLine}>
          Transactions:{' '}
          <Text style={styles.summaryValue}>{summary.transactions}</Text>
        </Text>
        <Text style={styles.summaryLine}>
          Budgets: <Text style={styles.summaryValue}>{summary.budgets}</Text>
        </Text>
        <Text style={styles.summaryLine}>
          Recurring:{' '}
          <Text style={styles.summaryValue}>{summary.recurring}</Text>
        </Text>
      </View>

      {/* Export */}
      <Text style={styles.sectionTitle}>Export</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          This will create a JSON export containing accounts, transactions,
          budgets, categories and recurring items. You can save it in a notes
          app, cloud storage, or send it to yourself.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={handleExportJSON}>
          <Text style={styles.primaryBtnText}>Export JSON</Text>
        </Pressable>
      </View>

      {/* Import */}
      <Text style={styles.sectionTitle}>Import</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Paste JSON previously exported from Debit Lens into the box below,
          then tap Import. Matching data sets (accounts, transactions, budgets,
          recurring) will be replaced if present in the JSON.
        </Text>
        <TextInput
          style={styles.importInput}
          value={importText}
          onChangeText={setImportText}
          placeholder="Paste export JSON here..."
          placeholderTextColor="#6b7280"
          multiline
        />
        <View style={styles.importButtons}>
          <Pressable
            style={[styles.secondaryBtn, { marginRight: 8 }]}
            onPress={() => setImportText('')}
          >
            <Text style={styles.secondaryBtnText}>Clear</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={handleImport}>
            <Text style={styles.primaryBtnText}>Import</Text>
          </Pressable>
        </View>
      </View>

      {lastStatus ? (
        <Text style={styles.statusText}>{lastStatus}</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  h1: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 2,
  },
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: 16,
  },
  summaryTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  summaryLine: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 12,
    marginBottom: 12,
  },
  bodyText: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 10,
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },
  primaryBtnText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#111827',
  },
  secondaryBtnText: {
    color: '#E5E7EB',
    fontWeight: '500',
    fontSize: 13,
  },
  importInput: {
    marginTop: 8,
    minHeight: 140,
    borderRadius: 8,
    backgroundColor: '#111827',
    color: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  importButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
  },
});

export default DataExportImportScreen;
