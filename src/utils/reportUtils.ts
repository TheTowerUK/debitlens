// src/utils/reportUtils.ts
import type { Transaction } from '../types/finance';
import type { ReportPreset } from '../types/report';


/** Checks if a date string falls within a range */
export function inRange(isoDate: string, start: Date, end: Date): boolean {
  const d = new Date(isoDate).getTime();
  return d >= start.getTime() && d <= end.getTime();
}

/** Returns start/end dates for a preset range */
export function startEndForPreset(preset: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_WEEK' | 'CUSTOM'): { start: Date, end: Date } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  end.setHours(23, 59, 59, 999);
  start.setHours(0, 0, 0, 0);

  if (preset === 'THIS_WEEK') {
    const day = start.getDay();
    const diffToMon = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMon);
    return { start, end };
  }

  if (preset === 'LAST_MONTH') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const firstLastMonth = new Date(y, m - 1, 1);
    const lastLastMonth = new Date(y, m, 0, 23, 59, 59, 999);
    return { start: firstLastMonth, end: lastLastMonth };
  }

  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start: first, end: last };
}

/** Filters transactions by date, account, and category */
export function filterTxns(
  txns: Transaction[],
  opts: { dateStart: Date; dateEnd: Date; accountId?: string; category?: string }
): Transaction[] {
  return txns.filter(t =>
    inRange(t.date, opts.dateStart, opts.dateEnd) &&
    (!opts.accountId || t.accountId === opts.accountId) &&
    (!opts.category || t.category === opts.category)
  );
}

/** Totals income, expense, and net */
export function totals(txns: Transaction[]): { income: number; expense: number; net: number } {
  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense };
}

/** Aggregates transactions by category */
export function byCategory(txns: Transaction[]): { category: string; value: number }[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    const sign = t.type === 'expense' ? -1 : 1;
    map.set(t.category, (map.get(t.category) ?? 0) + sign * t.amount);
  }
  return Array.from(map, ([category, value]) => ({ category, value }));
}

/** Aggregates transactions by day */
export function byDay(txns: Transaction[]): { date: string; value: number }[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    const key = t.date.slice(0, 10);
    const sign = t.type === 'expense' ? -1 : 1;
    map.set(key, (map.get(key) ?? 0) + sign * t.amount);
  }
  return Array.from(map, ([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Aggregates transactions by account */
export function groupByAccount(txns: Transaction[]): { accountId: string; value: number }[] {
  const map = new Map<string, number>();
  for (const t of txns) {
    const key = t.accountId;
    const sign = t.type === 'expense' ? -1 : 1;
    map.set(key, (map.get(key) ?? 0) + sign * t.amount);
  }
  return Array.from(map, ([accountId, value]) => ({ accountId, value }));
}

/** Formats a date range for display */
export function rangeLabel(start: Date, end: Date): string {
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);
  return `${s} to ${e}`;
}

/** Maps preset ID to label */
export function presetLabel(preset: string): string {
  return {
    THIS_MONTH: 'This Month',
    LAST_MONTH: 'Last Month',
    THIS_WEEK: 'This Week',
    CUSTOM: 'Custom Range',
  }[preset] || 'Custom';
}
