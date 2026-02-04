// NOTE: Reporting model locked. See: REPORTING_MODEL_LOCK.md
// src/hooks/reports/useTotals.ts
import { useMemo } from 'react';
import type { Transaction } from '../../state/AppContext';
import { computeTotals } from '../../utils/reporting';

/** Income/expense/net and count (transfers excluded from count and net). Delegates to reporting.computeTotals. */
export function useTotals(filteredTxs: Transaction[]) {
  return useMemo(() => computeTotals(filteredTxs), [filteredTxs]);
}
