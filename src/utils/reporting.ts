// src/utils/reporting.ts
import type { Transaction } from '../state/AppContext';

export type ReportPeriod = 'thisMonth' | 'lastMonth' | 'allTime' | 'month';

export function computeTotals(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') income += amt;
    else if (t.type === 'expense') expense += amt;
  }
  return {
    income,
    expense,
    net: income - expense,
    count: txs.length,
  };
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
