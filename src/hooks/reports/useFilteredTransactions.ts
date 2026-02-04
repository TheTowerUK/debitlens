// NOTE: Reporting model locked. See: REPORTING_MODEL_LOCK.md
// src/hooks/reports/useFilteredTransactions.ts
import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';
import { parseYMDLocal } from '../../utils/date';

/** Filter txs by range [start, end) and category. Excludes transfers. Range end is exclusive (use d < end). */
export function useFilteredTransactions(
  txs: Transaction[],
  range: { start: Date; end: Date },
  categoryKey: string
) {
  return useMemo(() => {
    const out: Transaction[] = [];
    for (const t of txs) {
      if (!t?.date) continue;
      if (t.type === 'transfer') continue;
      const d = parseYMDLocal(t.date);
      if (!d) continue;
      if (d < range.start || d >= range.end) continue;

      const cat = (t.category || '').trim();
      if (cat !== categoryKey) continue;

      out.push(t);
    }

    // Newest first
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }, [txs, range.start, range.end, categoryKey]);
}
