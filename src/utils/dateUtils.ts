// src/utils/dateUtils.ts

const pad = (n: number): string => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function isISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s || '');
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1);
}

// Monday-start week helpers (UK/EU style)
export function startOfWeek(d = new Date()): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function endOfWeek(d = new Date()): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return e;
}

export function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, d.getDate());
}

export function getPresetRange(id: string): { start: string, end: string } {
  const now = new Date();
  if (id === 'thisw') {
    return { start: toISO(startOfWeek(now)), end: toISO(now) };
  }
  if (id === 'this') {
    return { start: toISO(startOfMonth(now)), end: toISO(now) };
  }
  if (id === 'last') {
    const prev = addMonths(now, -1);
    return { start: toISO(startOfMonth(prev)), end: toISO(endOfMonth(prev)) };
  }
  if (id === 'ytd') {
    return { start: toISO(startOfYear(now)), end: toISO(now) };
  }
  if (id === 'l12') {
    const start = startOfMonth(addMonths(now, -11));
    return { start: toISO(start), end: toISO(now) };
  }
  return { start: '', end: todayISO() };
}

export const PRESETS = [
  { id: 'thisw', label: 'This Week' },
  { id: 'this', label: 'This Month' },
  { id: 'last', label: 'Last Month' },
  { id: 'ytd', label: 'YTD' },
  { id: 'l12', label: 'Last 12m' },
  { id: 'all', label: 'All Time' },
];

export function activePresetFor(start: string, end: string): string | null {
  for (const p of PRESETS) {
    const r = getPresetRange(p.id);
    if ((r.start || '') === (start || '') && (r.end || '') === (end || '')) return p.id;
  }
  return null;
}

export function rangeLabel(start: string, end: string): string {
  const presetId = activePresetFor(start, end);
  const preset = PRESETS.find(p => p.id === presetId);
  return preset?.label || (start && end ? `${start} to ${end}` : 'All Time');
}
