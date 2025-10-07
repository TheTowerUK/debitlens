// If you like, keep these JSDoc hints for editor intellisense:
/**
 * @typedef {"income" | "expense"} TxnType
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} accountId
 * @property {string=} accountName
 * @property {string} date        // ISO "YYYY-MM-DD"
 * @property {number} amount
 * @property {TxnType} type
 * @property {string} category
 * @property {string=} note
 */

/** @param {string} isoDate @param {Date} start @param {Date} end */
export function inRange(isoDate, start, end) {
  const d = new Date(isoDate).getTime();
  return d >= start.getTime() && d <= end.getTime();
}

/** @param {"THIS_MONTH"|"LAST_MONTH"|"THIS_WEEK"|"CUSTOM"} preset */
export function startEndForPreset(preset) {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  end.setHours(23,59,59,999);
  start.setHours(0,0,0,0);

  if (preset === 'THIS_WEEK') {
    const day = start.getDay();            // 0 Sun … 6 Sat
    const diffToMon = (day + 6) % 7;       // Monday-based
    start.setDate(start.getDate() - diffToMon);
    return { start, end };
  }

  if (preset === 'LAST_MONTH') {
    const y = now.getFullYear();
    const m = now.getMonth();              // 0..11
    const firstLastMonth = new Date(y, m - 1, 1);
    const lastLastMonth  = new Date(y, m, 0, 23, 59, 59, 999);
    return { start: firstLastMonth, end: lastLastMonth };
  }

  // THIS_MONTH (default)
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { start: first, end: last };
}

/**
 * @param {Transaction[]} txns
 * @param {{dateStart: Date, dateEnd: Date, accountId?: string, category?: string}} opts
 */
export function filterTxns(txns, opts) {
  return txns.filter(t =>
    inRange(t.date, opts.dateStart, opts.dateEnd) &&
    (!opts.accountId || t.accountId === opts.accountId) &&
    (!opts.category  || t.category  === opts.category)
  );
}

/** @param {Transaction[]} txns */
export function totals(txns) {
  const income  = txns.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense };
}

/** @param {Transaction[]} txns */
export function byCategory(txns) {
  const map = new Map();
  for (const t of txns) {
    const sign = t.type === 'expense' ? -1 : 1;
    map.set(t.category, (map.get(t.category) ?? 0) + sign * t.amount);
  }
  return Array.from(map, ([category, value]) => ({ category, value }));
}

/** @param {Transaction[]} txns */
export function byDay(txns) {
  const map = new Map();
  for (const t of txns) {
    const key = t.date.slice(0, 10); // YYYY-MM-DD
    const sign = t.type === 'expense' ? -1 : 1;
    map.set(key, (map.get(key) ?? 0) + sign * t.amount);
  }
  return Array.from(map, ([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
