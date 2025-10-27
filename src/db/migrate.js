// src/db/migrate.js (excerpt)
import * as FileSystem from 'expo-file-system';
import { getDb } from './db';
import * as m003 from './migrations/003_reports';
import * as m004 from './migrations/004_accounts';

const MIGRATIONS = [
  { id: m003.id, up: m003.up },
  { id: m004.id, up: m004.up },
];

async function resetDatabaseFile() {
  const path = FileSystem.documentDirectory + 'SQLite/app.db';
  await FileSystem.deleteAsync(path, { idempotent: true });
  console.log('DB reset: deleted', path);
}

export async function runMigrations() {
  try {
    await runMigrationsOnce();
  } catch (e) {
    console.warn('[DB] Migrations failed, resetting DB and retrying once…', e);
    await resetDatabaseFile();
    await runMigrationsOnce(); // retry on a clean file
  }
}

async function runMigrationsOnce() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    (await db.getAllAsync(`SELECT id FROM _migrations`)).map(r => r.id)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    await db.execAsync('BEGIN');
    try {
      for (const stmt of m.up.split(';').map(s => s.trim()).filter(Boolean)) {
        await db.execAsync(stmt + ';');
      }
      await db.runAsync(
        `INSERT INTO _migrations (id, applied_at) VALUES (?, datetime('now'))`,
        m.id
      );
      await db.execAsync('COMMIT');
    } catch (err) {
      await db.execAsync('ROLLBACK');
      throw err;
    }
  }
}
