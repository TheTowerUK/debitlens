import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';
import { computeTotals } from '../../utils/reporting';

export function useReportTotals(txs: Transaction[]) {
  return useMemo(() => computeTotals(txs), [txs]);
}
