// NOTE: Transfer and recurring invariants are locked.
// See: DATA_MODEL_LOCK.md
// src/utils/txDisplay.ts
// Signed amount and display helpers for transaction rows (account context for transfers).

import type { Account, Transaction } from '../state/AppContext';

export function accountNameById(accountsById: Record<string, Account>, id?: string): string {
  if (!id) return '';
  return accountsById[id]?.name ?? id;
}

export function isTransfer(t: Transaction): boolean {
  return t.type === 'transfer';
}

/**
 * IMPORTANT:
 * - For transfers, signed amount depends on which account screen you're on:
 *   from = -amount, to = +amount
 * - For global screens (no account context), return 0 for transfers
 */
export function getSignedAmountForAccount(t: Transaction, accountId?: string): number {
  if (t.type === 'income') return +t.amount;
  if (t.type === 'expense') return -t.amount;

  if (t.type === 'transfer') {
    if (!accountId) return 0;

    const fromId = t.fromAccountId ?? t.accountId;
    const toId = t.toAccountId;

    if (fromId === accountId) return -t.amount;
    if (toId === accountId) return +t.amount;
    return 0;
  }

  return 0;
}

/**
 * Account-scoped transfer text:
 * - "Transfer out" + "To: X"
 * - "Transfer in" + "From: X"
 */
export function getTransferLabelAndNoteForAccount(
  t: Transaction,
  currentAccountId: string,
  accountsById: Record<string, Account>
): { label: string; note: string } {
  const fromId = t.fromAccountId ?? t.accountId;
  const toId = t.toAccountId; // may be undefined in legacy/bad rows

  // SAFETY: only treat as incoming if we actually have a toId
  const incoming = !!toId && toId === currentAccountId;

  const otherId = incoming ? fromId : toId;
  const otherName = accountNameById(accountsById, otherId) || 'Unknown';

  const label = incoming ? 'Transfer in' : 'Transfer out';

  const prefix =
    incoming
      ? `From: ${otherName}`
      : toId
        ? `To: ${otherName}`
        : 'To: Unknown';

  const desc = (t.description || '').trim();
  return { label, note: desc ? `${prefix} • ${desc}` : prefix };
}

/**
 * Global (Recent Activity) transfer text:
 * - Label: "Transfer"
 * - Note: "A → B"
 */
export function getTransferLabelAndNoteGlobal(
  t: Transaction,
  accountsById: Record<string, Account>
): { label: string; note: string } {
  const fromId = t.fromAccountId ?? t.accountId;
  const toId = t.toAccountId;

  const fromName = accountNameById(accountsById, fromId) || 'Unknown';
  const toName = toId ? (accountNameById(accountsById, toId) || 'Unknown') : 'Unknown';

  const desc = (t.description || '').trim();
  return {
    label: 'Transfer',
    note: desc ? `${fromName} → ${toName} • ${desc}` : `${fromName} → ${toName}`,
  };
}
