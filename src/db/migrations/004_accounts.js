// 004_accounts.js
export default {
  id: 4,
  name: 'accounts',
  async up(db) {
    // accounts table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        createdAt INTEGER NOT NULL DEFAULT(strftime('%s','now')*1000),
        updatedAt INTEGER NOT NULL DEFAULT(strftime('%s','now')*1000)
      );
    `);

    // transactions.accountId column (if your schema uses accountId, rename below accordingly)
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN account_id TEXT;
    `).catch(() => {}); // ignore if exists

    // ensure "unassigned" account
    await db.execAsync(`
      INSERT OR IGNORE INTO accounts (id, name, type)
      VALUES ('unassigned', 'Unassigned', 'virtual');
    `);
  },
  async down(db) {
    // no-op (keep accounts)
  },
};
