//src/services/accounts.js
 
import { getDb } from '../db/db';


export async function listAccounts() {
  const db = await getDb();
  const rows = await db.getAllAsync(`SELECT id, name, type, createdAt, updatedAt FROM accounts ORDER BY name`);
  return rows || [];
}

export async function getAccount(id) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT id, name, type, createdAt, updatedAt FROM accounts WHERE id = ?`, [id]);
  return row || null;
}

export async function upsertAccount({ id, name, type = null }) {
  if (!id || !name) throw new Error('id and name required');
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, updatedAt=excluded.updatedAt`,
    [id, name, type, now, now]
  );
}

export async function deleteAccount(id) {
  if (!id || id === 'unassigned') throw new Error('Cannot delete this account');
  const db = await getDb();
  // reassign its transactions to "unassigned"
  await db.runAsync(`UPDATE transactions SET account_id = 'unassigned' WHERE account_id = ?`, [id]);
  // delete account
  await db.runAsync(`DELETE FROM accounts WHERE id = ?`, [id]);
}

