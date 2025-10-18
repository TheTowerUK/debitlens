// src/db/db.js
// Use the classic WebSQL-style API from the main entry.
import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabase('app.db');
