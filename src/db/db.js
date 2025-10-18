// src/db/db.js
import { openDatabaseAsync } from 'expo-sqlite';

let _db = null;

/** Get (and cache) a single DB handle using the modern async API */
export async function getDb() {
  if (_db) return _db;
  _db = await openDatabaseAsync('app.db');
  // optional but safe
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  return _db;
}
