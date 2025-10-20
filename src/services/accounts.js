// src/services/accounts.js
import { getDb } from '../db/db';

const UNASSIGNED_ID = 'unassigned';
const UNASSIGNED_NAME = 'Unassigned';

async function ensureUnassignedAccount(db) {
  const exists = await db.getFirstAsync('SELECT id FROM accounts WHERE id = ?', UNASSIGNED_ID);
  if (!exists) {
    await db.runAsync(
      'INSERT INTO accounts (id, name) VALUES (?, ?)',
      UNASSIGNED_ID, UNASSIGNED_NAME
    );
  }
}

/**
 * Delete an account:
 * - reassign its transactions to 'unassigned'
 * - delete the account
 */
export async function deleteAccount(accountId) {
  const db = await getDb();
  // reassign txns to 'unassigned' then delete
  await db.runAsync('UPDATE transactions SET account_id = ? WHERE account_id = ?', 'unassigned', accountId);
  await db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
}

export async function getAccount(accountId) {
  const db = await getDb();
  return await db.getFirstAsync('SELECT * FROM accounts WHERE id = ?', accountId);
}

  // make sure fallback exists
  await ensureUnassignedAccount(db);

  // reassign any transactions
  await db.runAsync(
    'UPDATE transactions SET account_id = ? WHERE account_id = ?',
    UNASSIGNED_ID, accountId
  );


