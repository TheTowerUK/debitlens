// src/db/db.js
import { openDatabaseAsync } from 'expo-sqlite';
let _db = null;
export async function getDb() {
  if (_db) return _db;
  _db = await openDatabaseAsync('app.db');  // bump to 'app.v3.db' once if needed
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  return _db;
}
