// src/db/migrate.js
import { getDb } from './db';
import * as m003 from './migrations/003_reports';
import * as m004 from './migrations/004_accounts';

const MIGRATIONS = [
  { id: m003.id, up: m003.up },
  { id: m004.id, up: m004.up },
];

// Split on semicolons but ignore blanks/comments
function splitStatements(sql) {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
}

export async function runMigrations() {
  const db = await getDb();

  // Ensure migrations table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync(`SELECT id FROM _migrations ORDER BY id ASC`);
  const applied = new Set(appliedRows.map(r => r.id));

  // Run each migration in its own transaction
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;

    console.log(`[DB] Running migration ${m.id}`);
    try {
      await db.execAsync('BEGIN');
      const stmts = splitStatements(m.up);
      for (const stmt of stmts) {
        console.log(`[DB] SQL: ${stmt}`);
        await db.execAsync(stmt + ';');
      }
      await db.runAsync(
        `INSERT INTO _migrations (id, applied_at) VALUES (?, datetime('now'))`,
        m.id
      );
      await db.execAsync('COMMIT');
      console.log(`[DB] Migration ${m.id} OK`);
    } catch (e) {
      console.warn(`[DB] Migration ${m.id} FAILED`, e);
      try { await db.execAsync('ROLLBACK'); } catch {}
      throw e; // bubble up so we see it
    }
  }
}
