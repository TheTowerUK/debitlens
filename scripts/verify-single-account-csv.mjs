#!/usr/bin/env node
/**
 * Verification: sample CSV with single "Account" column (maps to Account A only).
 * Confirms: income imports (Account B = Account A fallback); transfer skips with message.
 * Run: node scripts/verify-single-account-csv.mjs
 */

function normType(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'income' || s === 'credit' || s === 'in') return 'income';
  if (s === 'expense' || s === 'debit' || s === 'out') return 'expense';
  if (s === 'transfer') return 'transfer';
  return null;
}

// Sample CSV: only Date, Amount, Description, Category, Type, Account (no Account B column)
// So getCell(..., 'accountA') = value from Account column; getCell(..., 'accountB') = ''
const ROWS = [
  { date: '2026-02-01', amount: 24.99, description: 'Tesco', category: 'Groceries', type: 'expense', accountA: 'Monzo', accountB: '' },
  { date: '2026-02-01', amount: 2000, description: 'Salary', category: 'Salary', type: 'income', accountA: 'HSBC', accountB: '' },
  { date: '2026-02-02', amount: 150, description: 'Move funds', category: 'Transfers', type: 'transfer', accountA: 'HSBC', accountB: '' },
];

let imported = 0;
let skippedInvalidType = 0;
let skippedMissingAccountAForTransfer = 0;
let skippedTransferMissingAccountB = 0;
let skippedInvalidAccountForType = 0;

console.log('--- Sample CSV: single Account column (Account → accountA; accountB empty) ---\n');

ROWS.forEach((row, i) => {
  const accountATrim = String(row.accountA ?? '').trim();
  const accountBTrim = String(row.accountB ?? '').trim();
  const effectiveAccountB = accountBTrim || accountATrim;
  const type = normType(row.type);

  if (!type) {
    skippedInvalidType++;
    console.log(`Row ${i + 2}: type="${row.type}" → unknown type, SKIP (skippedInvalidType)`);
    return;
  }

  if (type === 'expense' && !accountATrim) {
    skippedInvalidAccountForType++;
    console.log(`Row ${i + 2}: expense, no Account A → SKIP`);
    return;
  }
  if (type === 'income' && !effectiveAccountB) {
    skippedInvalidAccountForType++;
    console.log(`Row ${i + 2}: income, no Account B (and no A for fallback) → SKIP`);
    return;
  }
  if (type === 'transfer') {
    if (!accountATrim) {
      skippedMissingAccountAForTransfer++;
      console.log(`Row ${i + 2}: transfer, no Account A → SKIP (skippedMissingAccountAForTransfer)`);
      return;
    }
    if (!accountBTrim) {
      skippedTransferMissingAccountB++;
      console.log(`Row ${i + 2}: transfer, no Account B → SKIP (skippedTransferMissingAccountB) — message: "Transfer rows require Account A and Account B."`);
      return;
    }
  }

  const accountForTx = type === 'expense' ? accountATrim : type === 'income' ? effectiveAccountB : null;
  imported++;
  console.log(`Row ${i + 2}: ${type} → IMPORT (account: ${accountForTx ?? 'A+B'})${type === 'income' ? ' — income used effectiveAccountB (fallback from A)' : ''}`);
});

console.log('\n--- Result ---');
console.log(`Imported: ${imported}`);
console.log(`Skipped (invalid type): ${skippedInvalidType}`);
console.log(`Skipped (transfer missing A): ${skippedMissingAccountAForTransfer}`);
console.log(`Skipped (transfer missing B): ${skippedTransferMissingAccountB}`);
console.log(`Skipped (wrong/missing account for type): ${skippedInvalidAccountForType}`);

const ok = imported === 2 && skippedTransferMissingAccountB === 1 && ROWS[0].type === 'expense' && ROWS[1].type === 'income' && ROWS[2].type === 'transfer';
console.log(ok ? '\n✓ PASS: expense + income imported; transfer skipped with message.' : '\n✗ FAIL');
process.exit(ok ? 0 : 1);
