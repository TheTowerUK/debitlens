// NOTE: Reporting model locked. See: REPORTING_MODEL_LOCK.md
// src/utils/reporting.ts
import type { Transaction } from '../state/AppContext';

export type ReportPeriod = 'thisMonth' | 'lastMonth' | 'allTime' | 'month';

export function computeTotals(txs: Transaction[]) {
  if (__DEV__) {
    const hasTransfer = txs.some((t) => t.type === 'transfer');
    if (hasTransfer) {
      console.warn(
        '[Reporting] Transfers passed into computeTotals; totals will ignore them. Check filters.'
      );
    }
  }
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      income += amt;
      count++;
    } else if (t.type === 'expense') {
      expense += amt;
      count++;
    }
    // transfers excluded from count and net
  }
  return {
    income,
    expense,
    net: income - expense,
    count,
  };
}

/** Totals for transfers only (reported separately; do not add to net). */
export function computeTransferTotals(txs: Transaction[]) {
  let amount = 0;
  let count = 0;
  for (const t of txs) {
    if (t.type === 'transfer') {
      amount += Number(t.amount) || 0;
      count++;
    }
  }
  return { amount, count };
}

export function monthKeyFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function addMonths(monthKey: string, delta: number) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const date = new Date(y, m - 1 + delta, 1);
  return monthKeyFromDate(date);
}

export function formatMonthLabel(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1, 1);
  // e.g. "January 2026"
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

/** Returns { start, end } for the given month. End is exclusive; filters must use date < end. */
export function rangeForMonthKey(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

export function getReportRange(period: ReportPeriod, monthKey?: string) {
  if (period === 'allTime') {
    return { start: new Date(0), end: new Date(8640000000000000) };
  }

  const nowKey = monthKeyFromDate(new Date());

  if (period === 'thisMonth') return rangeForMonthKey(nowKey);
  if (period === 'lastMonth') return rangeForMonthKey(addMonths(nowKey, -1));

  // period === 'month'
  const effective = monthKey || nowKey;
  return rangeForMonthKey(effective);
}

export function getPeriodLabel(period: ReportPeriod, monthKey?: string) {
  if (period === 'allTime') return 'All time';
  if (period === 'thisMonth') return 'This month';
  if (period === 'lastMonth') return 'Last month';
  return formatMonthLabel(monthKey || monthKeyFromDate(new Date()));
}
