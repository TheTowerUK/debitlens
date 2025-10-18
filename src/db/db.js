// Use the legacy (WebSQL-style) API so tx.executeSql(...) works
import * as SQLite from 'expo-sqlite/legacy';

export const db = SQLite.openDatabase('app.db');
