// src/services/reporting.js
import { db } from '../db/db';

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

// CRUD
export function saveReport(r) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO reports (id, name, type, params, created_at, updated_at)
         VALUES (
          ?, ?, ?, ?,
          COALESCE((SELECT created_at FROM reports WHERE id=?), datetime('now')),
          datetime('now')
         )`,
        [r.id, r.name, r.type, JSON.stringify(r.params || {}), r.id],
        () => resolve(),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function listReports() {
  return new Promise((resolve, reject) => {
    db.readTransaction(tx => {
      tx.executeSql(
        'SELECT * FROM reports ORDER BY updated_at DESC',
        [],
        (_, { rows }) => {
          const out = rows._array.map(x => ({
            id: x.id,
            name: x.name,
            type: x.type,
            params: JSON.parse(x.params || '{}'),
            createdAt: x.created_at,
            updatedAt: x.updated_at,
          }));
          resolve(out);
        },
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function getReport(id) {
  return new Promise((resolve, reject) => {
    db.readTransaction(tx => {
      tx.executeSql(
        'SELECT * FROM reports WHERE id=? LIMIT 1',
        [id],
        (_, { rows }) => {
          if (!rows.length) return resolve(null);
          const x = rows.item(0);
          resolve({
            id: x.id,
            name: x.name,
            type: x.type,
            params: JSON.parse(x.params || '{}'),
            createdAt: x.created_at,
            updatedAt: x.updated_at,
          });
        },
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

// Datasets
export function getSpendOverTime(filter = {}) {
  const { where, args } = paramsForFilter(filter);
  return new Promise((resolve, reject) => {
    const since = filter.dateFrom || '1900-01-01';
    const until = filter.dateTo || new Date().toISOString().slice(0, 10);
    const days = Math.ceil((+new Date(until) - +new Date(since)) / 86400000);
    const bucket = days > 60 ? '%Y-%m' : '%Y-%m-%d';

    db.readTransaction(tx => {
      tx.executeSql(
        `
        SELECT strftime(?, date) AS bucket,
               ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS spend
        FROM transactions
        ${where}
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [bucket, ...args],
        (_, { rows }) => resolve(rows._array.map(r => ({ x: r.bucket, spend: r.spend }))),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}

export function getByCategory(filter = {}) {
  const { where, args } = paramsForFilter(filter);
  return new Promise((resolve, reject) => {
    db.readTransaction(tx => {
      tx.executeSql(
        `
        SELECT category_id AS categoryId,
               ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS spend
        FROM transactions
        ${where}
        GROUP BY category_id
        HAVING spend > 0
        ORDER BY spend DESC
        `,
        args,
        (_, { rows }) => resolve(rows._array),
        (_, err) => { reject(err); return false; }
      );
    });
  });
}
