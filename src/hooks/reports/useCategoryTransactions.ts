import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';

export function useCategoryTransactions(txs: Transaction[], categoryKey: string) {
  return useMemo(() => {
    const cat = (categoryKey || '').trim() || 'Uncategorised';

    const filtered = (txs || []).filter((t) => {
      const tCat = (String((t as any).category ?? 'Uncategorised').trim() || 'Uncategorised');
      return tCat === cat;
    });

    // Keep newest first (dates are YYYY-MM-DD)
    return filtered.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [txs, categoryKey]);
}
