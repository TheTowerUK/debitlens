// src/hooks/useFilteredTransactions.ts
import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';

export function useFilteredTransactions(
  txs: Transaction[],
  range: { start: Date; end: Date },
  categoryKey: string
) {
  return useMemo(() => {
    const out: Transaction[] = [];
    for (const t of txs) {
      if (!t?.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < range.start || d >= range.end) continue;

      // Your reports use categoryKey; transactions have category string.
      const cat = (t.category || '').trim();
      if (cat !== categoryKey) continue;

      out.push(t);
    }

    // Newest first
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }, [txs, range.start, range.end, categoryKey]);
}
