// NOTE: Reporting model locked. See: REPORTING_MODEL_LOCK.md
// src/hooks/reports/useReportRange.ts
import { useMemo } from 'react';
import {
  type ReportPeriod,
  getReportRange,
  getPeriodLabel,
  monthKeyFromDate,
} from '../../utils/reporting';

/** Wraps getReportRange + getPeriodLabel for the given period and optional monthKey. Range end is exclusive. */
export function useReportRange(period: ReportPeriod, monthKey?: string) {
  const effectiveMonthKey =
    period === 'month' ? (monthKey || monthKeyFromDate(new Date())) : undefined;

  const range = useMemo(() => {
    return getReportRange(period, effectiveMonthKey);
  }, [period, effectiveMonthKey]);

  const label = useMemo(() => {
    return getPeriodLabel(period, effectiveMonthKey);
  }, [period, effectiveMonthKey]);

  return { range, label, effectiveMonthKey };
}
