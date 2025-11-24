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
import { formatDateDDMMYYYY } from '../utils/formatDate';

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
  const accounts = (state.accounts as Account[] | undefined) ?? [];

  const [importText, setImportText] = useState('');
  const [lastStatus, setLastStatus] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<'all' | string>('all');

  type CsvPeriod = 'thisMonth' | 'lastMonth' | 'allTime';
  type CsvTxFilter = 'all' | 'income' | 'expense';

  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('thisMonth');
  const [csvTxFilter, setCsvTxFilter] = useState<CsvTxFilter>('all');

  const summary = useMemo(
    () => ({
      accounts: state.accounts?.length ?? 0,
      transactions: state.transactions?.length ?? 0,
      budgets: state.budgets?.length ?? 0,
      recurring: state.recurring?.length ?? 0,
    }),
    [state.accounts, state.transactions, state.budgets, state.recurring]
  );

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    (state.accounts as Account[] | undefined)?.forEach((a) => {
      if (a.id) {
        map.set(a.id, a.name || 'Account');
      }
    });
    return map;
  }, [state.accounts]);

  const csvEscape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const s = String(value).replace(/"/g, '""');
    // wrap in quotes if contains comma, quote, or newline
    if (/[",\n\r]/.test(s)) {
      return `"${s}"`;
    }
    return s;
  };

  const handleExportCSV = async () => {
    try {
      const txs = (state.transactions as Transaction[] | undefined) ?? [];
      if (txs.length === 0) {
        Alert.alert('No transactions', 'There are no transactions to export yet.');
        return;
      }

      // date boundaries for period filters
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = thisMonthStart;

      const filteredTxs = txs.filter((t) => {
        // period filter
        if (t.date) {
          const d = new Date(t.date);
          if (!isNaN(d.getTime())) {
            let inPeriod = false;
            switch (csvPeriod) {
              case 'thisMonth':
                inPeriod = d >= thisMonthStart && d < nextMonthStart;
                break;
              case 'lastMonth':
                inPeriod = d >= lastMonthStart && d < lastMonthEnd;
                break;
              case 'allTime':
              default:
                inPeriod = true;
                break;
            }
            if (!inPeriod) return false;
          }
        } else if (csvPeriod !== 'allTime') {
          // no date + not "all time" => exclude
          return false;
        }

        // account filter
        if (selectedAccountId !== 'all') {
          if (!t.accountId || t.accountId !== selectedAccountId) {
            return false;
          }
        }

        // type filter
        if (csvTxFilter !== 'all') {
          if (t.type !== csvTxFilter) {
            return false;
          }
        }

        return true;
      });

      if (filteredTxs.length === 0) {
        Alert.alert(
          'No transactions',
          'No transactions match the selected period, account, and type filters.'
        );
        return;
      }

      const headers = ['Date', 'Type', 'Account', 'Category', 'Amount', 'Note'];
      const rows: string[] = [];
      rows.push(headers.join(','));

      filteredTxs.forEach((t) => {
        const date = t.date ? formatDateDDMMYYYY(t.date) : '';
        const typeLabel = t.type === 'income' ? 'Income' : 'Expense';
        const accountName = t.accountId
          ? accountNameById.get(t.accountId) ?? ''
          : '';
        const category = t.category ?? '';
        const amount = Number(t.amount) || 0;
        const note = t.note ?? '';

        const line = [
          csvEscape(date),
          csvEscape(typeLabel),
          csvEscape(accountName),
          csvEscape(category),
          csvEscape(amount.toFixed(2)),
          csvEscape(note),
        ].join(',');

        rows.push(line);
      });

      const csv = rows.join('\n');

      await Share.share({
        title: 'Debit Lens – transactions.csv',
        message: csv,
      });

      setLastStatus(
        `Exported CSV (${csvPeriod}, ${csvTxFilter}, ${
          selectedAccountId === 'all' ? 'all accounts' : 'one account'
        }).`
      );
    } catch (err) {
      console.error('CSV export error', err);
      Alert.alert('Export failed', 'Something went wrong while exporting CSV.');
    }
  };


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
    Export your data as JSON (for full backup/restore) or as a CSV list of
    transactions that you can open in Excel or Google Sheets. Use the filters
    below to control which transactions go into the CSV.
  </Text>

  {/* Period selector */}
  <View style={styles.selectorBlock}>
    <Text style={styles.selectorLabel}>Period for CSV export</Text>
    <View style={styles.chipRow}>
      <Pressable
        style={[
          styles.filterChip,
          csvPeriod === 'thisMonth' && styles.filterChipSelected,
        ]}
        onPress={() => setCsvPeriod('thisMonth')}
      >
        <Text
          style={[
            styles.filterChipText,
            csvPeriod === 'thisMonth' && styles.filterChipTextSelected,
          ]}
        >
          This month
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.filterChip,
          csvPeriod === 'lastMonth' && styles.filterChipSelected,
        ]}
        onPress={() => setCsvPeriod('lastMonth')}
      >
        <Text
          style={[
            styles.filterChipText,
            csvPeriod === 'lastMonth' && styles.filterChipTextSelected,
          ]}
        >
          Last month
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.filterChip,
          csvPeriod === 'allTime' && styles.filterChipSelected,
        ]}
        onPress={() => setCsvPeriod('allTime')}
      >
        <Text
          style={[
            styles.filterChipText,
            csvPeriod === 'allTime' && styles.filterChipTextSelected,
          ]}
        >
          All time
        </Text>
      </Pressable>
    </View>
  </View>

  {/* Type filter */}
  <View style={styles.selectorBlock}>
    <Text style={styles.selectorLabel}>Type filter</Text>
    <View style={styles.chipRow}>
      <Pressable
        style={[
          styles.filterChip,
          csvTxFilter === 'all' && styles.filterChipSelected,
        ]}
        onPress={() => setCsvTxFilter('all')}
      >
        <Text
          style={[
            styles.filterChipText,
            csvTxFilter === 'all' && styles.filterChipTextSelected,
          ]}
        >
          All
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.filterChip,
          csvTxFilter === 'income' && styles.filterChipSelected,
        ]}
        onPress={() => setCsvTxFilter('income')}
      >
        <Text
          style={[
            styles.filterChipText,
            csvTxFilter === 'income' && styles.filterChipTextSelected,
          ]}
        >
          Income only
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.filterChip,
          csvTxFilter === 'expense' && styles.filterChipSelected,
        ]}
        onPress={() => setCsvTxFilter('expense')}
      >
        <Text
          style={[
            styles.filterChipText,
            csvTxFilter === 'expense' && styles.filterChipTextSelected,
          ]}
        >
          Expenses only
        </Text>
      </Pressable>
    </View>
  </View>

  {/* Account filter for CSV */}
  {accounts.length > 0 && (
    <View style={styles.selectorBlock}>
      <Text style={styles.selectorLabel}>Account for CSV export</Text>
      <View style={styles.accountChipRow}>
        <Pressable
          style={[
            styles.accountChip,
            selectedAccountId === 'all' && styles.accountChipSelected,
          ]}
          onPress={() => setSelectedAccountId('all')}
        >
          <Text
            style={[
              styles.accountChipText,
              selectedAccountId === 'all' && styles.accountChipTextSelected,
            ]}
          >
            All accounts
          </Text>
        </Pressable>

        {accounts.map((acc) => (
          <Pressable
            key={acc.id}
            style={[
              styles.accountChip,
              selectedAccountId === acc.id && styles.accountChipSelected,
            ]}
            onPress={() => setSelectedAccountId(acc.id)}
          >
            <Text
              style={[
                styles.accountChipText,
                selectedAccountId === acc.id && styles.accountChipTextSelected,
              ]}
            >
              {acc.name || 'Account'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )}

  <Pressable style={styles.primaryBtn} onPress={handleExportJSON}>
    <Text style={styles.primaryBtnText}>Export JSON (full backup)</Text>
  </Pressable>

  <Pressable
    style={[styles.secondaryBtn, { marginTop: 8 }]}
    onPress={handleExportCSV}
  >
    <Text style={styles.secondaryBtnText}>
      Export CSV (transactions with filters)
    </Text>
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
    accountSelector: {
    marginTop: 8,
    marginBottom: 8,
  },
  selectorLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  accountChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  accountChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#020617',
  },
  accountChipSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#111827',
  },
  accountChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  accountChipTextSelected: {
    color: '#BFDBFE',
    fontWeight: '600',
  },
  selectorBlock: {
    marginTop: 8,
    marginBottom: 8,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#020617',
  },
  filterChipSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#111827',
  },
  filterChipText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: '#BFDBFE',
    fontWeight: '600',
  },

});

export default DataExportImportScreen;
