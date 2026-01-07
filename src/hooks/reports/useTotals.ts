// src/hooks/useTotals.ts
import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';

export function useTotals(filteredTxs: Transaction[]) {
  return useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of filteredTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }

    return {
      income,
      expense,
      net: income - expense,
      count: filteredTxs.length,
    };
  }, [filteredTxs]);
}
