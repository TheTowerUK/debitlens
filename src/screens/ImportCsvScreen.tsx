// src/screens/ImportCsvScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

// Clipboard: try community package first, fall back gracefully
let Clipboard: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Clipboard = require('@react-native-clipboard/clipboard')?.default;
} catch {
  try {
    // Older RN (some versions had Clipboard in core)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Clipboard = require('react-native')?.Clipboard;
  } catch {
    Clipboard = null;
  }
}

type Props = NativeStackScreenProps<RootStackParamList, 'ImportCSV'>;

function buildCsvTemplate(): string {
  // Capitalised headers for a more professional look
  const header = ['Date', 'Account', 'Amount', 'Description', 'Category', 'Type'];

  // Example rows users can overwrite
  const rows = [
    ['2025-10-27', 'First Direct', '-72.59', 'BRITISH GAS', 'Direct Debit', 'Expense'],
    ['2025-10-27', 'First Direct', '-11.99', 'Prime Video', 'TV Subscriptions', 'Expense'],
    ['2025-10-25', 'First Direct', '1621.20', 'Sterling Solutions Ltd', 'Salary', 'Income'],
    ['2025-10-25', 'First Direct', '-50.00', 'Transfer to Savings', 'Money Transfer', 'Transfer'],
  ];

  const esc = (v: string) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  return lines.join('\n') + '\n';
}

export default function ImportCsvScreen({ navigation }: Props) {
  const [showTemplate, setShowTemplate] = useState(false);

  const templateCsv = useMemo(() => buildCsvTemplate(), []);

  const handleCopyTemplate = useCallback(async () => {
    if (!Clipboard || typeof Clipboard.setString !== 'function') {
      Alert.alert(
        'Clipboard unavailable',
        'Clipboard is not available in this build. Install @react-native-clipboard/clipboard to enable one-click copy.'
      );
      return;
    }

    try {
      Clipboard.setString(templateCsv);
      Alert.alert('Copied', 'CSV template copied to clipboard. Paste into Excel/Sheets and save as CSV.');
    } catch (e: any) {
      Alert.alert('Copy failed', e?.message ?? 'Unknown error');
    }
  }, [templateCsv]);

  const handleHowToUse = useCallback(() => {
    Alert.alert(
      'How to use the template',
      Platform.OS === 'web'
        ? [
            '1) Copy the CSV template',
            '2) Paste into a new Google Sheet',
            '3) Fill/replace rows with your transactions',
            '4) File → Download → Comma-separated values (.csv)',
            '5) Import the saved CSV into DebitLens',
          ].join('\n')
        : [
            '1) Copy the CSV template',
            '2) Paste into Excel (desktop) or Google Sheets',
            '3) Fill/replace rows with your transactions',
            '4) Save/export as .csv',
            '5) Import the saved CSV into DebitLens',
          ].join('\n')
    );
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Import CSV</Text>
            <Text style={styles.subtle}>
              Use the official DebitLens template to avoid bank-specific CSV quirks.
            </Text>
          </View>

          <View style={styles.pillsRow}>
            <Pressable style={styles.headerPill} onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={styles.headerPillText}>Back</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>DebitLens CSV Template</Text>

          <Text style={styles.body}>
            Headers are capitalised and must match exactly:
            {'\n'}
            <Text style={styles.mono}>Date, Account, Amount, Description, Category, Type</Text>
          </Text>

          <View style={styles.actionsRow}>
            <Pressable style={styles.btnPrimary} onPress={handleCopyTemplate} hitSlop={8}>
              <Text style={styles.btnPrimaryText}>Copy template CSV</Text>
            </Pressable>

            <Pressable
              style={[styles.btnSecondary, showTemplate && styles.btnSecondaryOn]}
              onPress={() => setShowTemplate((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.btnSecondaryText}>{showTemplate ? 'Hide' : 'Preview'}</Text>
            </Pressable>

            <Pressable style={styles.btnSecondary} onPress={handleHowToUse} hitSlop={8}>
              <Text style={styles.btnSecondaryText}>How to use</Text>
            </Pressable>
          </View>

          {showTemplate ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Template preview</Text>
              <ScrollView horizontal style={{ maxHeight: 220 }}>
                <Text style={styles.previewText}>{templateCsv}</Text>
              </ScrollView>
            </View>
          ) : null}

          <View style={{ marginTop: 10 }}>
            <Text style={styles.hint}>
              • Date must be <Text style={styles.mono}>YYYY-MM-DD</Text>
              {'\n'}• Type must be <Text style={styles.mono}>Expense</Text>,{' '}
              <Text style={styles.mono}>Income</Text>, or <Text style={styles.mono}>Transfer</Text>
              {'\n'}• Amount should be negative for Expense, positive for Income
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next steps</Text>
          <Text style={styles.body}>
            After importing a few months, open <Text style={styles.mono}>Recurring → Detect</Text> to
            suggest recurring payments (we’ll make this merchant-based next).
          </Text>
        </View>

        {!Clipboard ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Optional improvement</Text>
            <Text style={styles.warnText}>
              For one-click copy, install{' '}
              <Text style={styles.mono}>@react-native-clipboard/clipboard</Text>.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  wrap: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    columnGap: 8,
  },
  h1: { color: theme.text, fontSize: 26, fontWeight: '800' },
  subtle: { color: theme.textDim, marginTop: 4, flexShrink: 1 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 10 },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', marginBottom: 8 },

  body: { color: theme.textDim, lineHeight: 18 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },

  btnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.link,
    backgroundColor: theme.cardAlt,
  },
  btnPrimaryText: { color: theme.link, fontWeight: '900' },

  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  btnSecondaryOn: { borderColor: theme.link },
  btnSecondaryText: { color: '#E5E7EB', fontWeight: '800' },

  previewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
  },
  previewTitle: { color: '#E5E7EB', fontWeight: '800', marginBottom: 6 },
  previewText: {
    color: '#E5E7EB',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },

  hint: { color: theme.textDim, fontSize: 12, opacity: 0.9 },

  warnBox: {
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  warnTitle: { color: '#E5E7EB', fontWeight: '900', marginBottom: 6 },
  warnText: { color: theme.textDim, lineHeight: 18 },
});
