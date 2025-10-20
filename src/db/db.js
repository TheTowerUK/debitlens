// src/db/db.js
import { openDatabaseAsync } from 'expo-sqlite';
const DB_NAME = 'app.v3.db'; // bump this once to start fresh
let _db = null;
export async function getDb() {
  if (_db) return _db;
  _db = await openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  return _db;
}
