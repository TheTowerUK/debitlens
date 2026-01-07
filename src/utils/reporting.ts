// src/utils/reporting.ts
import type { Transaction } from '../state/AppContext';

export type ReportPeriod = 'thisMonth' | 'lastMonth' | 'allTime' | 'month';

export type DateRange = {
  start: Date; // inclusive
  end: Date;   // exclusive
  label: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function monthKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function parseYMD(dateStr: string): Date | null {
  // expects YYYY-MM-DD (which Phase 3.1 enforces)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const dt = new Date(y, mm - 1, dd);
  if (isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}

export function getReportRange(period: ReportPeriod, monthKey?: string): DateRange {
  const now = new Date();

  if (period === 'allTime') {
    return {
      start: new Date(1900, 0, 1),
      end: new Date(2100, 0, 1),
      label: 'All time',
    };
  }

  if (period === 'month') {
    const mk = monthKey ?? monthKeyFromDate(now);
    const m = /^(\d{4})-(\d{2})$/.exec(mk);
    const y = m ? Number(m[1]) : now.getFullYear();
    const mm = m ? Number(m[2]) : now.getMonth() + 1;
    const start = new Date(y, mm - 1, 1);
    const end = new Date(y, mm, 1);
    return { start, end, label: formatMonthLabel(start) };
  }

  // thisMonth / lastMonth
  const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (period === 'thisMonth') {
    return { start: thisStart, end: thisEnd, label: formatMonthLabel(thisStart) };
  }

  // lastMonth
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: lastStart, end: lastEnd, label: formatMonthLabel(lastStart) };
}

export function formatMonthLabel(d: Date) {
  // e.g. "March 2026"
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export function filterTransactionsByRange(
  txs: Transaction[],
  range: { start: Date; end: Date }
) {
  const out: Transaction[] = [];
  for (const t of txs || []) {
    if (!t?.date) continue;
    const dt = parseYMD(t.date);
    if (!dt) continue;
    if (dt >= range.start && dt < range.end) out.push(t);
  }
  // newest first
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

export type Totals = { income: number; expense: number; net: number };

export function computeTotals(txs: Transaction[]): Totals {
  let income = 0;
  let expense = 0;

  for (const t of txs || []) {
    const amt = Number((t as any).amount) || 0;

    // Prefer t.type if present, fallback to sign
    const type = (t as any).type as string | undefined;

    if (type === 'income') income += Math.abs(amt);
    else if (type === 'expense') expense += Math.abs(amt);
    else {
      // fallback: negative => expense, positive => income
      if (amt < 0) expense += Math.abs(amt);
      else income += Math.abs(amt);
    }
  }

  return { income, expense, net: income - expense };
}

export type CategoryTotal = {
  categoryKey: string;
  totalExpense: number; // positive number (spend)
  count: number;
};

export function computeCategoryTotals(txs: Transaction[]): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();

  for (const t of txs || []) {
    const type = (t as any).type as string | undefined;
    if (type && type !== 'expense') continue;

    const amt = Number((t as any).amount) || 0;
    // expense spend: store positive
    const spend = Math.abs(amt);
    if (!spend) continue;

    const cat = String((t as any).category ?? 'Uncategorised').trim() || 'Uncategorised';
    const cur = map.get(cat) ?? { total: 0, count: 0 };
    cur.total += spend;
    cur.count += 1;
    map.set(cat, cur);
  }

  return Array.from(map.entries())
    .map(([categoryKey, v]) => ({
      categoryKey,
      totalExpense: v.total,
      count: v.count,
    }))
    .sort((a, b) => b.totalExpense - a.totalExpense);
}

export type TrendPoint = {
  monthKey: string;       // YYYY-MM
  label: string;          // "Mar 2026"
  income: number;
  expense: number;
  net: number;
};

export function computeMonthlyTrend(txs: Transaction[], monthsBack = 6): TrendPoint[] {
  const now = new Date();
  const points: TrendPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const slice = filterTransactionsByRange(txs, { start, end });
    const totals = computeTotals(slice);

    const mk = monthKeyFromDate(start);
    const label = start.toLocaleString(undefined, { month: 'short', year: 'numeric' });

    points.push({
      monthKey: mk,
      label,
      income: totals.income,
      expense: totals.expense,
      net: totals.net,
    });
  }

  return points;
}
