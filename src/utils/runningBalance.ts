// utils/runningBalance.ts
import type { Account, Transaction } from "../state/AppContext"; // adjust import path

export function buildBalanceAfterMapForAccount(
  account: Account,
  allTxs: Transaction[]
): Record<string, number> {
  // Filter to txs that affect this account (income/expense by accountId, or transfer where account is from/to)
  const txs = allTxs.filter(
    (t) =>
      t.accountId === account.id ||
      (t.type === "transfer" &&
        (t.fromAccountId === account.id || t.toAccountId === account.id))
  );

  // Sort by date, then by name (stable-ish tie-breaker)
  const sorted = [...txs].sort((a, b) => {
    const d = (a.date || "").localeCompare(b.date || "");
    if (d !== 0) return d;
    return (a.name || "").localeCompare(b.name || "");
  });

  let bal = Number(account.balance) || 0;
  const map: Record<string, number> = {};

  for (const t of sorted) {
    const amt = Number(t.amount) || 0;
    if (t.type === "income") bal += amt;
    else if (t.type === "expense") bal -= amt;
    else if (t.type === "transfer" && t.fromAccountId && t.toAccountId) {
      if (t.fromAccountId === account.id) bal -= amt;
      else if (t.toAccountId === account.id) bal += amt;
    }

    map[t.id] = bal;
  }

  return map;
}
