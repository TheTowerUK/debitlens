// src/hooks/reports/useFilteredTransactions.ts
import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';
import { filterTransactionsByRange } from '../../utils/reporting';

export function useFilteredTransactions(txs: Transaction[], start: Date, end: Date) {
  return useMemo(() => filterTransactionsByRange(txs, { start, end }), [txs, start, end]);
}

