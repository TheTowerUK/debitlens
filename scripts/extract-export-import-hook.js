const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'src', 'screens', 'DataExportImportScreen.tsx');
const hooksDir = path.join(root, 'src', 'hooks');

if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

const content = fs.readFileSync(srcPath, 'utf8');
const lines = content.split(/\r?\n/);

// Hook: lines 1-2318 (0-indexed: 0-2317), but we change header and body
const headerLines = lines.slice(0, 39);
let header = headerLines.join('\n');
header = header
  .replace('// src/screens/DataExportImportScreen.tsx', '// src/hooks/useDataExportImport.ts')
  .replace("import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';")
  .replace(/import \{[^}]+\} from 'react-native';/, "import { Alert } from 'react-native';")
  .replace(/import type \{ NativeStackScreenProps \} from '@react-navigation\/native-stack';\r?\n/, '')
  .replace(/import \{ useFocusEffect \} from '@react-navigation\/native';\r?\n/, '')
  .replace(/import type \{ RootStackParamList \} from '\.\.\/navigations\/types';\r?\n\r?\n/, '')
  .replace(/import \{ colors as theme \} from '\.\.\/theme\/colors';\r?\n\r?\n/, '')
  .replace(/type Props = NativeStackScreenProps<RootStackParamList, 'DataExportImport'>;\r?\n\r?\n/, '');

let body = lines.slice(39, 2318).join('\n');
body = body
  .replace(/export default function DataExportImportScreen\(_props: Props\) \{\s*\n\s*const \{ state/, 'export function useDataExportImport() {\n  const { state');
body = body.replace(
  /useFocusEffect\(\s*useCallback\(\(\) => \{\s*return \(\) => \{\s*setShowPreview\(false\);\s*setJsonPreview\(null\);\s*setShowTemplatePreview\(false\);\s*setShowExportPreview\(false\);\s*setShowCsvPreview\(false\);\s*\};\s*\}, \[\]\)\s*\);/,
  ''
);

// Add onBlurCleanup, handleExportJsonTemplateFile, handleDiscardPendingImport and return object before closing
const returnBlock = `
  const onBlurCleanup = useCallback(() => {
    setShowPreview(false);
    setJsonPreview(null);
    setShowTemplatePreview(false);
    setShowExportPreview(false);
    setShowCsvPreview(false);
  }, []);

  const handleExportJsonTemplateFile = async () => {
    try {
      const backup = createBackupV1({
        accounts: [],
        transactions: [],
        recurring: [],
        budgets: [],
      });
      const json = JSON.stringify(backup, null, 2);
      const filename = \`DebitLens_Backup_Empty_Template_\${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json\`;
      await writeAndShareFile(filename, json, 'application/json');
      setLastStatus('Empty JSON template exported to Files (via Share).');
    } catch (err) {
      console.error(err);
      setLastStatus(\`Template export failed: \${String(err?.message ?? err)}\`);
      Alert.alert('Export failed', 'Could not export empty JSON template.');
    }
  };

  const handleDiscardPendingImport = useCallback(() => {
    Alert.alert('Discard pending import', 'This will remove pending imported data. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          setPendingTxs([]);
          setPendingAccounts([]);
          setPendingActive(false);
          existingKeysRef.current = null;
          await clearPending();
          setLastStatus('Pending import discarded.');
        },
      },
    ]);
  }, [clearPending]);

  return {
    accounts,
    txs,
    recurring,
    budgets,
    lastStatus,
    jsonPreview,
    jsonRestoreMode,
    setJsonRestoreMode,
    showPreview,
    setShowPreview,
    handleExportJsonFile,
    handleExportJsonTemplateFile,
    handlePickJsonBackup,
    handleApplyJsonRestore,
    showTemplatePreview,
    setShowTemplatePreview,
    templateCsvText,
    showExportPreview,
    setShowExportPreview,
    exportCsvText,
    csvIncludeDescription,
    setCsvIncludeDescription,
    csvIncludeAccountName,
    setCsvIncludeAccountName,
    handleExportCsvPreview,
    handleGenerateCsv,
    handleExportCsvFile,
    isTransactionsCsvGenerated,
    importCsvText,
    lastImportSummary,
    createMissingAccounts,
    setCreateMissingAccounts,
    csvRestoreMode,
    setCsvRestoreMode,
    recurringRebuildMode,
    setRecurringRebuildMode,
    lastCsvStats,
    showCsvPreview,
    setShowCsvPreview,
    handlePickCsvFile,
    handleApplyCsvRestore,
    handleApplyCsvImportPress,
    handleContinueCsvImportPress,
    importBatchOffset,
    importTotalDataRows,
    importHasMoreBatches,
    importLastFilename,
    pendingActive,
    pendingTxs,
    pendingAccounts,
    handleCommitPendingImport,
    handleDiscardPendingImport,
    progress,
    progressElapsedSec,
    handleRebuildRecurringNow,
    onBlurCleanup,
  };
}
`;

// body currently ends with "  };" (handleApplyCsvRestore). We need to add the new block before the final closing brace of the function
// The function ends at line 2318 which is "  };". So we need to insert our block before "  return (" - but we removed "return (", so the body ends with "  };\n" (handleApplyCsvRestore). So we append returnBlock (which starts with const onBlurCleanup) and ends with "}\n".
const outContent = header + body + returnBlock;
const outPath = path.join(hooksDir, 'useDataExportImport.ts');
fs.writeFileSync(outPath, outContent);
console.log('Wrote', outPath, outContent.length, 'chars');
