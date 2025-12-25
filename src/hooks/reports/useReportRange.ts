// src/reports/hooks/useReportRange.ts
import { useMemo } from 'react';

export type ReportPeriod = 'thisMonth' | 'lastMonth' | 'allTime' | 'month';

export function monthKeyFromDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`; // YYYY-MM
}

export function addMonths(monthKey: string, delta: number) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyFromDate(d);
}

export function rangeForMonthKey(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return { start, end };
}

export function formatMonthLabel(monthKey: string) {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(y, m - 1, 1);
  try {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return monthKey;
  }
}

export function useReportRange(period: ReportPeriod, monthKey?: string) {
  const effectiveMonthKey =
    period === 'month' ? (monthKey || monthKeyFromDate(new Date())) : undefined;

  const range = useMemo(() => {
    if (period === 'allTime') {
      return { start: new Date(0), end: new Date(8640000000000000) };
    }
    if (period === 'thisMonth') return rangeForMonthKey(monthKeyFromDate(new Date()));
    if (period === 'lastMonth') return rangeForMonthKey(addMonths(monthKeyFromDate(new Date()), -1));
    return rangeForMonthKey(effectiveMonthKey!);
  }, [period, effectiveMonthKey]);

  const label = useMemo(() => {
    if (period === 'allTime') return 'All time';
    if (period === 'thisMonth') return formatMonthLabel(monthKeyFromDate(new Date()));
    if (period === 'lastMonth') return formatMonthLabel(addMonths(monthKeyFromDate(new Date()), -1));
    return effectiveMonthKey ? formatMonthLabel(effectiveMonthKey) : 'Month';
  }, [period, effectiveMonthKey]);

  return { range, effectiveMonthKey, label };
}
