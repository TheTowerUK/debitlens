import { Alert } from 'react-native';
import { normalizeImportRow, type ImportRow } from './validation';
import type { ImportSummary } from './importSummary';

export function importCsvRowsWithValidation(params: {
  rows: ImportRow[];
  accounts: { id: string }[];
  actions: { addTransaction: (input: any) => any };
}): ImportSummary {
  const { rows, accounts, actions } = params;

  const knownAccountIds = new Set(accounts.map((a) => a.id));

  const summary: ImportSummary = {
    imported: 0,
    skipped: 0,
    warnings: [],
    errors: [],
  };

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2; // assumes header row

    const res = normalizeImportRow(row, rowIndex, knownAccountIds);

    if (res.ok === false) {
      summary.skipped += 1;
      summary.errors.push(...res.errors);
      return;
    }

    summary.warnings.push(...res.warnings);

    actions.addTransaction({
      accountId: res.value.accountId,
      date: res.value.date,
      type: res.value.type,
      amount: res.value.amount,
      category: res.value.category,
      description: res.value.description,
      merchant: res.value.merchant,
      name: res.value.description ?? '',
    });

    summary.imported += 1;
  });

  return summary;
}

export function alertImportSummary(summary: ImportSummary) {
  const lines: string[] = [
    `Imported: ${summary.imported}`,
    `Skipped: ${summary.skipped}`,
  ];

  if (summary.errors.length) {
    lines.push('');
    lines.push('Errors (first few):');
    summary.errors.slice(0, 8).forEach((e) =>
      lines.push(`• Row ${e.rowIndex}: ${e.message}`)
    );
  }

  if (summary.warnings.length) {
    lines.push('');
    lines.push('Warnings (first few):');
    summary.warnings.slice(0, 5).forEach((w) =>
      lines.push(`• Row ${w.rowIndex}: ${w.message}`)
    );
  }

  Alert.alert('CSV Import result', lines.join('\n'));
}
