// src/hooks/reports/useReportRange.ts
import { useMemo } from 'react';
import { getReportRange, type ReportPeriod } from '../../utils/reporting';

export function useReportRange(period: ReportPeriod, monthKey?: string) {
  return useMemo(() => getReportRange(period, monthKey), [period, monthKey]);
}

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


