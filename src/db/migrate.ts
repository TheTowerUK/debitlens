import * as SQLite from 'expo-sqlite';
const db = (SQLite as any).openDatabase('app.db');

// Each migration has a unique ID and SQL statement
const MIGRATION_REGISTRY: { id: string; sql: string }[] = [
  {
    id: '001-init-accounts',
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        createdAt TEXT
      );
    `,
  },
  {
    id: '002-init-transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY NOT NULL,
        accountId TEXT,
        amount REAL,
        category TEXT,
        date TEXT,
        FOREIGN KEY (accountId) REFERENCES accounts(id)
      );
    `,
  },
  {
    id: '003-add-notes-to-transactions',
    sql: `
      ALTER TABLE transactions ADD COLUMN notes TEXT;
    `,
  },
  // Add future migrations here
];

export async function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Ensure the migrations table exists
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY NOT NULL
        );
      `);

      // Apply each migration if not already applied
      MIGRATION_REGISTRY.forEach(({ id, sql }) => {
        tx.executeSql(
          `SELECT id FROM migrations WHERE id = ?`,
          [id],
          (_, result) => {
            if (result.rows.length === 0) {
              tx.executeSql(sql);
              tx.executeSql(`INSERT INTO migrations (id) VALUES (?)`, [id]);
              console.log(`[DB] Applied migration: ${id}`);
            } else {
              console.log(`[DB] Skipped migration: ${id}`);
            }
          }
        );
      });
    },
    error => {
      console.warn('[DB] Migration failed', error);
      reject(error);
    },
    () => {
      console.log('[DB] Migrations complete');
      resolve();
    });
  });
}
