// src/utils/money.ts

// Parses "1,234.56", "£12.34", "(12.34)", "-12.34" safely.
export function parseAmount(input: unknown): number | null {
  if (input == null) return null;

  let s = String(input).trim();
  if (!s) return null;

  // Parentheses indicate negative
  const isParenNeg = /^\(.*\)$/.test(s);
  if (isParenNeg) s = s.slice(1, -1);

  // Remove currency symbols and spaces
  s = s.replace(/[£$€\s]/g, '');

  // Remove thousands separators
  s = s.replace(/,/g, '');

  // Must be numeric now
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  return isParenNeg ? -Math.abs(n) : n;
}

// Enforce a single rule across the app:
// income => positive, expense => negative
export function normalizeAmountForType(
  type: 'income' | 'expense',
  amount: number
) {
  const a = Number(amount) || 0;
  return type === 'expense' ? -Math.abs(a) : Math.abs(a);
}
