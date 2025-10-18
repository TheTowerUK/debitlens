// src/db/migrate.js
import * as SQLite from 'expo-sqlite/legacy';
import * as m003 from './migrations/003_reports';

const db = SQLite.openDatabase('app.db');

// Register migrations in order. Add 004_*.js, 005_*.js here later.
const MIGRATIONS = [
  // { id: 1, up: '...' },
  // { id: 2, up: '...' },
  { id: m003.id, up: m003.up },
];

function execAsync(tx, sql, args = []) {
  return new Promise((resolve, reject) => {
    tx.executeSql(
      sql,
      args,
      (_, res) => resolve(res),
      (_, err) => {
        reject(err);
        return false; // stop this statement
      }
    );
  });
}

export async function runMigrations() {
  return new Promise((outerResolve, outerReject) => {
    db.transaction(async (tx) => {
      try {
        // Table to track which migrations ran
        await execAsync(
          tx,
          `CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
          )`
        );

        // What’s already applied?
        const res = await execAsync(tx, `SELECT id FROM _migrations ORDER BY id ASC`);
        const applied = new Set((res?.rows?._array || []).map(r => r.id));

        // Run missing migrations
        for (const m of MIGRATIONS) {
          if (applied.has(m.id)) continue;

          // Run each statement (migration string may have multiple)
          const statements = m.up
            .split(';')
            .map(s => s.trim())
            .filter(Boolean);

          for (const stmt of statements) {
            await execAsync(tx, stmt + ';');
          }

          await execAsync(
            tx,
            `INSERT INTO _migrations (id, applied_at) VALUES (?, datetime('now'))`,
            [m.id]
          );
        }

        outerResolve();
      } catch (e) {
        outerReject(e);
      }
    });
  });
}
