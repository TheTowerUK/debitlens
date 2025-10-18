// src/db/db.js
import * as SQLite from 'expo-sqlite';

let _db = null;

/** Get (and cache) a single DB handle using the modern API */
export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('app.db');
  // Optional but recommended
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  return _db;
}
