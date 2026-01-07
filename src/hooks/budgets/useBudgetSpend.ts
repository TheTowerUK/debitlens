import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';

export function useBudgetSpend(
  txs: Transaction[],
  range: { start: Date; end: Date },
  categoryKey: string
) {
  return useMemo(() => {
    let spent = 0;

    for (const t of txs) {
      if (!t?.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < range.start || d >= range.end) continue;

      const cat = (t.category || '').trim();
      if (cat !== categoryKey) continue;

      // budgets usually apply to expenses only
      if (t.type !== 'expense') continue;

      // expense might be negative or positive depending on your app rules
      const amt = Number(t.amount) || 0;
      spent += Math.abs(amt);
    }

    return spent;
  }, [txs, range.start, range.end, categoryKey]);
}
