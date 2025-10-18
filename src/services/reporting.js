// src/services/reporting.js
import { getDb } from '../db/db';

// Helpers
function placeholders(arr) {
  return arr && arr.length ? `(${arr.map(() => '?').join(',')})` : '';
}
function inclusiveToEndOfDay(date) {
  if (!date) return undefined;
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function paramsForFilter(f = {}) {
  const nextDay = inclusiveToEndOfDay(f.dateTo);
  const where = [];
  const args = [];

  if (f.dateFrom) { where.push(`date >= ?`); args.push(f.dateFrom); }
  if (nextDay)     { where.push(`date < ?`);  args.push(nextDay); }

  if (f.accountIds && f.accountIds.length) {
    where.push(`account_id IN ${placeholders(f.accountIds)}`);
    args.push(...f.accountIds);
  }
  if (f.categoryIds && f.categoryIds.length) {
    where.push(`category_id IN ${placeholders(f.categoryIds)}`);
    args.push(...f.categoryIds);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

// ---------- CRUD ----------
export async function saveReport(r) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO reports (id, name, type, params, created_at, updated_at)
     VALUES (
       ?, ?, ?, ?,
       COALESCE((SELECT created_at FROM reports WHERE id=?), datetime('now')),
       datetime('now')
     )`,
    r.id, r.name, r.type, JSON.stringify(r.params || {}), r.id
  );
}

export async function listReports() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM reports ORDER BY updated_at DESC'
  );
  return rows.map(x => ({
    id: x.id,
    name: x.name,
    type: x.type,
    params: JSON.parse(x.params || '{}'),
    createdAt: x.created_at,
    updatedAt: x.updated_at,
  }));
}

export async function getReport(id) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT * FROM reports WHERE id=? LIMIT 1',
    id
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    params: JSON.parse(row.params || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------- datasets ----------
export async function getSpendOverTime(filter = {}) {
  const db = await getDb();
  const { where, args } = paramsForFilter(filter);

  const since = filter.dateFrom || '1900-01-01';
  const until = filter.dateTo || new Date().toISOString().slice(0, 10);
  const days = Math.ceil((+new Date(until) - +new Date(since)) / 86400000);
  const bucket = days > 60 ? '%Y-%m' : '%Y-%m-%d';

  const rows = await db.getAllAsync(
    `
    SELECT strftime(?, date) AS bucket,
           ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS spend
    FROM transactions
    ${where}
    GROUP BY bucket
    ORDER BY bucket ASC
    `,
    bucket, ...args
  );

  return rows.map(r => ({ x: r.bucket, spend: r.spend }));
}

export async function getByCategory(filter = {}) {
  const db = await getDb();
  const { where, args } = paramsForFilter(filter);

  const rows = await db.getAllAsync(
    `
    SELECT category_id AS categoryId,
           ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS spend
    FROM transactions
    ${where}
    GROUP BY category_id
    HAVING spend > 0
    ORDER BY spend DESC
    `,
    ...args
  );

  return rows;
}
