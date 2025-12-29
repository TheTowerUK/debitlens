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

type Props = NativeStackScreenProps<RootStackParamList, 'ImportCSV'>;

// Load Expo modules via require() to bypass any broken TS type resolution.
const FileSystem: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-file-system');
  } catch {
    return null;
  }
})();

const Sharing: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-sharing');
  } catch {
    return null;
  }
})();

function buildCsvTemplate(): string {
  const header = ['Date', 'Account', 'Amount', 'Description', 'Category', 'Type'];

  // Instruction row – users replace or delete this
  const instructionRow = [
    'YYYY-MM-DD',
    'Account name',
    '-12.34',
    'Merchant or Payee',
    'Category',
    'Expense|Income|Transfer',
  ];

  const esc = (v: string) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    header.map(esc).join(','),
    instructionRow.map(esc).join(','),
  ];

  return lines.join('\n') + '\n';
}


export default function ImportCsvScreen({ navigation }: Props) {
  const [showTemplate, setShowTemplate] = useState(false);

  const templateCsv = useMemo(() => buildCsvTemplate(), []);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      if (!FileSystem || typeof FileSystem.writeAsStringAsync !== 'function') {
        Alert.alert(
          'Not available',
          'expo-file-system is not available at runtime. Ensure it is installed and restart Expo with cache clear.'
        );
        return;
      }

      const fileName = 'DebitLens-CSV-Template.csv';
      const baseDir =
        FileSystem.documentDirectory ||
        FileSystem.cacheDirectory ||
        FileSystem.temporaryDirectory ||
        null;

      if (!baseDir) {
        Alert.alert('Not available', 'File storage is not available on this platform.');
        return;
      }

      const uri = baseDir + fileName;

      const encoding =
        FileSystem?.EncodingType?.UTF8 ||
        FileSystem?.EncodingType?.utf8 ||
        undefined;

      if (encoding) {
        await FileSystem.writeAsStringAsync(uri, templateCsv, { encoding });
      } else {
        await FileSystem.writeAsStringAsync(uri, templateCsv);
      }

      if (Sharing && typeof Sharing.isAvailableAsync === 'function') {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare && typeof Sharing.shareAsync === 'function') {
          await Sharing.shareAsync(uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Share DebitLens CSV Template',
            UTI: 'public.comma-separated-values-text',
          });
          return;
        }
      }

      Alert.alert('Template saved', `Saved CSV template here:\n\n${uri}`);
    } catch (e: any) {
      Alert.alert('Download failed', e?.message ?? 'Unknown error');
    }
  }, [templateCsv]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Import CSV</Text>
            <Text style={styles.subtle}>
              Download the official DebitLens template to avoid bank-specific CSV quirks.
            </Text>
          </View>

          <Pressable style={styles.headerPill} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.headerPillText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>DebitLens CSV Template</Text>

          <Text style={styles.body}>
            Headers (capitalised) must match exactly:
            {'\n'}
            <Text style={styles.mono}>Date, Account, Amount, Description, Category, Type</Text>
          </Text>

          <View style={styles.actionsRow}>
            <Pressable style={styles.btnPrimary} onPress={handleDownloadTemplate} hitSlop={8}>
              <Text style={styles.btnPrimaryText}>Download CSV Template</Text>
            </Pressable>

            <Pressable
              style={[styles.btnSecondary, showTemplate && styles.btnSecondaryOn]}
              onPress={() => setShowTemplate((v) => !v)}
              hitSlop={8}
            >
              <Text style={styles.btnSecondaryText}>
                {showTemplate ? 'Hide preview' : 'Preview'}
              </Text>
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

          <Text style={styles.hint}>
            • Date must be <Text style={styles.mono}>YYYY-MM-DD</Text>
            {'\n'}• Type must be <Text style={styles.mono}>Expense</Text>,{' '}
            <Text style={styles.mono}>Income</Text>, or <Text style={styles.mono}>Transfer</Text>
            {'\n'}• Amount negative for Expense, positive for Income
          </Text>

          {Platform.OS === 'web' ? (
            <Text style={styles.hint}>
              Note: On web, sharing may be unavailable; the file may still be written if storage is
              supported.
            </Text>
          ) : null}
        </View>
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

  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },

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

  hint: { color: theme.textDim, fontSize: 12, opacity: 0.9, marginTop: 10 },
});
