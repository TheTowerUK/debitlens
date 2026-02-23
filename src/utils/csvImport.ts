// NOTE: Transfer and recurring invariants are locked.
// See: DATA_MODEL_LOCK.md
// src/utils/csvImport.ts
// Canonical CSV header validation and mapping.
// Merchant is not required and is ignored if present (not in HEADER_ALIASES). Unknown columns are ignored.

// ---- Types ----
export type CanonicalCsvKey =
  | 'date'
  | 'accountA'
  | 'accountB'
  | 'amount'
  | 'description'
  | 'category'
  | 'type';

export type HeaderMap = {
  indexByKey: Partial<Record<CanonicalCsvKey, number>>;
  keysByIndex: Array<CanonicalCsvKey | null>;
};

/** Human-readable labels for each canonical column (for UI and errors). */
export const CSV_HEADER_LABELS: Record<CanonicalCsvKey, string> = {
  date: 'Date',
  accountA: 'Account A',
  accountB: 'Account B',
  amount: 'Amount',
  description: 'Description',
  category: 'Category',
  type: 'Type',
};

const LABEL = CSV_HEADER_LABELS;

// Required keys for your "semantic" CSV (merchant removed)
const REQUIRED_KEYS: CanonicalCsvKey[] = [
  'date',
  'amount',
  'description',
  'category',
  'type',
];

const HEADER_ALIASES: Record<string, CanonicalCsvKey> = {
  // Date
  date: 'date',
  transactiondate: 'date',
  'transaction date': 'date',

  // Accounts
  'account a': 'accountA',
  accounta: 'accountA',
  fromaccount: 'accountA',
  accountfrom: 'accountA',
  sourceaccount: 'accountA',
  acct: 'accountA',
  'account name': 'accountA',
  accountname: 'accountA',

  'account b': 'accountB',
  accountb: 'accountB',
  toaccount: 'accountB',
  accountto: 'accountB',
  destinationaccount: 'accountB',

  // Legacy single-account CSVs
  account: 'accountA',

  // Amount
  amount: 'amount',
  value: 'amount',

  // Description
  description: 'description',
  details: 'description',
  narrative: 'description',
  memo: 'description',
  payee: 'description',
  reference: 'description',
  notes: 'description',
  detail: 'description',
  desc: 'description',

  // Category
  category: 'category',
  'category name': 'category',
  categoryname: 'category',
  categories: 'category',

  // Type
  type: 'type',
  'transaction type': 'type',
  transactiontype: 'type',
};

/** One entry per canonical key: label and all accepted header aliases (for help text / UI). */
export type HeaderMappingOption = {
  key: CanonicalCsvKey;
  label: string;
  aliases: string[];
};

/** Returns canonical columns with their display label and accepted header aliases. Aliases include the canonical label (lowercased) and are deduped. */
export function getHeaderMappingLabels(): HeaderMappingOption[] {
  const byKey: Partial<Record<CanonicalCsvKey, string[]>> = {};
  for (const [alias, key] of Object.entries(HEADER_ALIASES)) {
    if (!byKey[key]) byKey[key] = [];
    byKey[key]!.push(alias);
  }
  const order: CanonicalCsvKey[] = [
    'date',
    'accountA',
    'accountB',
    'amount',
    'description',
    'category',
    'type',
  ];
  return order.map((key) => {
    const label = CSV_HEADER_LABELS[key];
    const canonicalLower = label.toLowerCase();
    const raw = byKey[key] ?? [];
    const seen = new Set<string>();
    const aliases: string[] = [];
    const add = (s: string) => {
      const n = s.trim().toLowerCase();
      if (n && !seen.has(n)) {
        seen.add(n);
        aliases.push(n);
      }
    };
    add(canonicalLower);
    raw.forEach((a) => add(a));
    return { key, label, aliases };
  });
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildHeaderMap(rawHeaders: string[]): HeaderMap {
  const indexByKey: Partial<Record<CanonicalCsvKey, number>> = {};
  const keysByIndex: Array<CanonicalCsvKey | null> = [];

  rawHeaders.forEach((h, idx) => {
    const norm = normalizeHeader(String(h ?? ''));
    const compact = norm.replace(/\s+/g, ''); // handles "AccountA" etc.

    const key = HEADER_ALIASES[norm] ?? HEADER_ALIASES[compact];

    if (!key) {
      // Unknown header (e.g. "Code Logic") → ignore
      keysByIndex[idx] = null;
      return;
    }

    // Keep first occurrence only
    if (typeof indexByKey[key] !== 'number') indexByKey[key] = idx;
    keysByIndex[idx] = key;
  });

  return { indexByKey, keysByIndex };
}

/**
 * Returns human-friendly missing columns string, or empty string if ok.
 * Your screen does: if (missingMessage) throw new Error(`Missing required columns: ${missingMessage}.`);
 */
export function validateRequiredHeaders(headerMap: HeaderMap): string {
  const missing: CanonicalCsvKey[] = [];

  for (const k of REQUIRED_KEYS) {
    if (typeof headerMap.indexByKey[k] !== 'number') missing.push(k);
  }

  // Require at least one account column to exist
  const hasA = typeof headerMap.indexByKey.accountA === 'number';
  const hasB = typeof headerMap.indexByKey.accountB === 'number';
  if (!hasA && !hasB) missing.push('accountA');

  // De-dupe and return human-friendly labels (Account A -> "Account A or Account B" when neither column exists)
  const unique = Array.from(new Set(missing));
  return unique
    .map((k) => (k === 'accountA' ? 'Account A or Account B' : LABEL[k]))
    .join(', ');
}
