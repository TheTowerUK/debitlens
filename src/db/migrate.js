// src/db/migrate.js
import { getDb } from './db';
import * as m003 from './migrations/003_reports';
import * as m004 from './migrations/004_accounts';  

// Add future migrations here (in order)
const MIGRATIONS = [
  { id: m003.id, up: m003.up },
  { id: m004.id, up: m004.up },   
];

export async function runMigrations() {
  const db = await getDb();

  // Table to track applied migrations
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // Which have already run?
const appliedRows = await db.getAllAsync(`SELECT id FROM _migrations ORDER BY id ASC`);
  const applied = new Set(appliedRows.map(r => r.id));

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    await db.execAsync(m.up);
    await db.runAsync(
      `INSERT INTO _migrations (id, applied_at) VALUES (?, datetime('now'))`,
      m.id
    );
  }
}
