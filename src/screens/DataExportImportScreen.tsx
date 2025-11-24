// src/screens/DataExportImportScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useApp } from '../state/AppContext';

type Props = {
  navigation: any; // you can replace 'any' with your stack param type later
};

const DataExportImportScreen: React.FC<Props> = ({ navigation }) => {
  const { state, actions } = useApp();
  const accounts = state.accounts ?? [];
  const transactions = state.transactions ?? [];

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [importText, setImportText] = useState<string>('');
  const [lastStatus, setLastStatus] = useState<string>('');

  // Filter transactions by selected account (or show all if none selected)
  const filteredTxs = useMemo(() => {
    if (!selectedAccountId) return transactions;
    return transactions.filter((t) => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  // --- CSV EXPORT -----------------------------------------------------------

  const sanitiseCsv = (value: unknown): string => {
    if (value == null) return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const exportText = useMemo(() => {
    if (!filteredTxs.length) return '';

    const header = 'id,accountId,date,type,amount,description,category';

    const rows = filteredTxs.map((t) =>
      [
        t.id,
        t.accountId,
        t.date,
        t.type,
        t.amount,
        sanitiseCsv(t.description),
        sanitiseCsv(t.category),
      ].join(',')
    );

    return [header, ...rows].join('\n');
  }, [filteredTxs]);

  // --- CSV IMPORT -----------------------------------------------------------

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(',').map((h) => h.trim());

    return dataLines.map((line) => {
      const cols = line.split(',');
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] ?? '';
      });
      return obj;
    });
  };

  const handleImport = () => {
    try {
      const rows = parseCsv(importText);
      let imported = 0;

      rows.forEach((row) => {
        if (!row.amount) return;

        const amount = Number(row.amount);
        if (!amount || Number.isNaN(amount)) return;

        actions.addTransaction({
          id: row.id || undefined,
          accountId:
            row.accountId ||
            selectedAccountId ||
            (accounts[0] && accounts[0].id),
          date: row.date || new Date().toISOString().slice(0, 10),
          type: row.type === 'income' ? 'income' : 'expense',
          amount,
          description: row.description || '',
          category: row.category || '',
        });

        imported += 1;
      });

      const msg = `Imported ${imported} transactions.`;
      setLastStatus(msg);
      Alert.alert('CSV Import', msg);
    } catch (err) {
      console.error(err);
      setLastStatus('Import failed');
      Alert.alert(
        'CSV Import',
        'Import failed – please check the CSV format and try again.'
      );
    }
  };

  // --- RENDER ---------------------------------------------------------------

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Export / Import Data (CSV)</Text>

      {/* Account filter row */}
      <Text style={styles.label}>Filter by account (optional)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.accountRow}
      >
        <View style={styles.accountButton}>
          <Button title="All" onPress={() => setSelectedAccountId(null)} />
        </View>
        {accounts.map((a) => (
          <View key={a.id} style={styles.accountButton}>
            <Button
              title={a.name || a.label || 'Account'}
              onPress={() => setSelectedAccountId(a.id)}
            />
          </View>
        ))}
      </ScrollView>

      {/* EXPORT */}
      <Text style={styles.subHeading}>Export</Text>
      <Text style={styles.help}>
        Copy the text below and paste it into a CSV file or spreadsheet.
      </Text>
      <TextInput
        style={[styles.textArea, styles.mono]}
        value={exportText}
        multiline
        editable={false}
      />

      {/* IMPORT */}
      <Text style={styles.subHeading}>Import</Text>
      <Text style={styles.help}>
        Paste CSV data here. Expected columns: id, accountId, date, type, amount,
        description, category.
      </Text>
      <TextInput
        style={[styles.textArea, styles.mono]}
        value={importText}
        onChangeText={setImportText}
        multiline
        placeholder={
          'id,accountId,date,type,amount,description,category\n' +
          '123,acc1,2025-01-01,income,1000,Salary,Job'
        }
      />

      <View style={styles.buttonRow}>
        <Button title="Import CSV" onPress={handleImport} />
      </View>

      {!!lastStatus && <Text style={styles.status}>{lastStatus}</Text>}
    </ScrollView>
  );
};

export default DataExportImportScreen;

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  accountButton: {
    marginRight: 8,
  },
  subHeading: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  help: {
    marginBottom: 8,
  },
  textArea: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  mono: {
    fontFamily: 'monospace',
  },
  buttonRow: {
    marginBottom: 12,
  },
  status: {
    marginTop: 4,
    fontStyle: 'italic',
  },
});
