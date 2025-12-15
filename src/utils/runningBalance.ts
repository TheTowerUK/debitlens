// utils/runningBalance.ts
import type { Account, Transaction } from "../state/AppContext"; // adjust import path

export function buildBalanceAfterMapForAccount(
  account: Account,
  allTxs: Transaction[]
): Record<string, number> {
  // Filter to txs that affect this account
  const txs = allTxs.filter((t) => t.accountId === account.id);

  // Sort by date, then by name (stable-ish tie-breaker)
  const sorted = [...txs].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return (a.name || "").localeCompare(b.name || "");
  });

  let bal = account.balance ?? 0; // starting point (your account balance field)
  // ⚠️ If account.balance is "current balance", see note below.
  const map: Record<string, number> = {};

  for (const t of sorted) {
    if (t.type === "income") bal += t.amount;
    else if (t.type === "expense") bal -= t.amount;
    else {
      // transfer: depends on how you've modelled it
      // If your transfer is represented as two txns (one per account), then this line is unnecessary.
      // If it's a single txn, you'd need extra fields like fromAccountId/toAccountId.
      // For now, ignore or treat as expense/income based on your current implementation.
    }

    map[t.id] = bal;
  }

  return map;
}
