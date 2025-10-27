import { getDb } from './db'; // adjust path if needed

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
];

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY NOT NULL
    );
  `);

  for (const { id, sql } of MIGRATION_REGISTRY) {
    const result = await db.getAllAsync(
      `SELECT id FROM migrations WHERE id = ?`,
      [id]
    );

    if (result.length === 0) {
      await db.execAsync(sql);
      await db.runAsync(`INSERT INTO migrations (id) VALUES (?)`, [id]);
      console.log(`[DB] Applied migration: ${id}`);
    } else {
      console.log(`[DB] Skipped migration: ${id}`);
    }
  }

  console.log('[DB] Migrations complete');
}
