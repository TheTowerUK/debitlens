// src/utils/validation.ts
import { normalizeDateToYMD } from './dates';
import { parseAmount, normalizeAmountForType } from './money';

export type ImportRow = {
  date?: unknown;
  accountId?: unknown;
  amount?: unknown;
  description?: unknown;
  category?: unknown;
  type?: unknown; // optional: 'income' | 'expense'
};

export type RowIssue = {
  rowIndex: number; // 1-based (you can choose how you count; importer uses +2 for header)
  code:
    | 'MISSING_FIELD'
    | 'BAD_DATE'
    | 'BAD_AMOUNT'
    | 'UNKNOWN_ACCOUNT'
    | 'BAD_TYPE';
  message: string;
};

export type NormalizedTxnDraft = {
  date: string; // YYYY-MM-DD
  accountId: string;
  amount: number; // normalized sign
  type: 'income' | 'expense';
  description?: string;
  category?: string;
};

// --- Discriminated union result types (fixes TS narrowing) ---
export type NormalizeRowOk = {
  ok: true;
  value: NormalizedTxnDraft;
  warnings: RowIssue[];
};

export type NormalizeRowFail = {
  ok: false;
  errors: RowIssue[];
};

export type NormalizeRowResult = NormalizeRowOk | NormalizeRowFail;

/**
 * Validate + normalize a parsed CSV row into a transaction draft.
 * Rules:
 * - accountId must exist and be in knownAccountIds
 * - date must be parseable into YYYY-MM-DD
 * - amount must be parseable
 * - type:
 *    - if provided must be 'income'|'expense'
 *    - else inferred from amount sign (>=0 income, <0 expense) with a warning
 * - amount sign normalized:
 *    - income => positive
 *    - expense => negative
 */
export function normalizeImportRow(
  row: ImportRow,
  rowIndex: number,
  knownAccountIds: Set<string>
): NormalizeRowResult {
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];

  // --- accountId ---
  const accountId = String(row.accountId ?? '').trim();
  if (!accountId) {
    errors.push({ rowIndex, code: 'MISSING_FIELD', message: 'Missing accountId' });
  } else if (!knownAccountIds.has(accountId)) {
    errors.push({
      rowIndex,
      code: 'UNKNOWN_ACCOUNT',
      message: `Unknown accountId: ${accountId}`,
    });
  }

  // --- date ---
  const date = normalizeDateToYMD(row.date);
  if (!date) {
    errors.push({
      rowIndex,
      code: 'BAD_DATE',
      message: `Unparseable date: ${String(row.date ?? '')}`,
    });
  }

  // --- amount ---
  const parsedAmt = parseAmount(row.amount);
  if (parsedAmt == null) {
    errors.push({
      rowIndex,
      code: 'BAD_AMOUNT',
      message: `Unparseable amount: ${String(row.amount ?? '')}`,
    });
  }

  // --- type ---
  let type: 'income' | 'expense' | null = null;
  const rawType = String(row.type ?? '').trim().toLowerCase();
  if (rawType) {
    if (rawType === 'income' || rawType === 'expense') {
      type = rawType as 'income' | 'expense';
    } else {
      errors.push({
        rowIndex,
        code: 'BAD_TYPE',
        message: `Invalid type: ${rawType}`,
      });
    }
  } else if (parsedAmt != null) {
    type = parsedAmt < 0 ? 'expense' : 'income';
    warnings.push({
      rowIndex,
      code: 'BAD_TYPE',
      message: `Type not provided; inferred as ${type} from amount sign`,
    });
  }

  if (errors.length) return { ok: false, errors };

  const amount = normalizeAmountForType(type!, parsedAmt!);

  const description = String(row.description ?? '').trim() || undefined;
  const category = String(row.category ?? '').trim() || undefined;

  return {
    ok: true,
    value: {
      date: date!,
      accountId,
      type: type!,
      amount,
      description,
      category,
    },
    warnings,
  };
}
