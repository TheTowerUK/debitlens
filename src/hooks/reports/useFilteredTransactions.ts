// src/reports/hooks/useFilteredTransactions.ts
import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';

export function useFilteredTransactions(
  txs: Transaction[],
  range: { start: Date; end: Date },
  categoryKey: string
) {
  return useMemo(() => {
    const { start, end } = range;
    const cat = (categoryKey || '').trim();

    const filtered = txs.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return false;
      if (d < start || d >= end) return false;

      const tCat = ((t.category || 'Uncategorised').trim() || 'Uncategorised');
      if (cat === 'Uncategorised') return tCat === 'Uncategorised';
      return tCat === cat;
    });

    return filtered.slice().sort((a, b) => {
      const da = a.date ? Date.parse(a.date) : 0;
      const db = b.date ? Date.parse(b.date) : 0;
      return db - da;
    });
  }, [txs, range, categoryKey]);
}
