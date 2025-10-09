// src/utils/dates.js
const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth   = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const startOfYear  = (d = new Date()) => new Date(d.getFullYear(), 0, 1);

// Monday-start week helpers (common in UK/EU)
export const startOfWeek = (d = new Date()) => {
  const day = d.getDay();                 // 0 (Sun) .. 6 (Sat)
  const diff = (day === 0 ? -6 : 1) - day; // shift so Monday is start
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  s.setHours(0, 0, 0, 0);
  return s;
};
export const endOfWeek = (d = new Date()) => {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return e;
};

export const addMonths = (d, delta) => new Date(d.getFullYear(), d.getMonth() + delta, d.getDate());

export function getPresetRange(id) {
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
    // last 12 months (inclusive): first day 11 months ago → today
    const start = startOfMonth(addMonths(now, -11));
    return { start: toISO(start), end: toISO(now) };
  }
  if (id === 'all') {
    return { start: '', end: todayISO() };
  }
  return { start: '', end: todayISO() };
}

export const PRESETS = [
  { id: 'thisw', label: 'This Week' }, // 👈 new
  { id: 'this',  label: 'This Month' },
  { id: 'last',  label: 'Last Month' },
  { id: 'ytd',   label: 'YTD' },
  { id: 'l12',   label: 'Last 12m' },
  { id: 'all',   label: 'All Time' },
];

export function activePresetFor(start, end) {
  for (const p of PRESETS) {
    const r = getPresetRange(p.id);
    if ((r.start || '') === (start || '') && (r.end || '') === (end || '')) return p.id;
  }
  return null;
}
