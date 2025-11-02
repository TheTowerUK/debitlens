// src/db/db.ts
import { openDatabaseAsync } from 'expo-sqlite';

let _db: any = null;
export async function getDb() {
  if (_db) return _db;
  _db = await openDatabaseAsync('app.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  return _db;
}

/**
 * executor(sql, args?) => Promise<any[]>
 * Wraps expo-sqlite transaction/executeSql and returns an array of rows.
 */
export async function executor(sql: string, args: any[] = []): Promise<any[]> {
  const db = await getDb();
  return new Promise<any[]>((resolve, reject) => {
    db.transaction(
      (tx: any) => {
        tx.executeSql(
          sql,
          args,
          (_tx: any, result: any) => {
            const rows = result?.rows?._array ?? []; // expo-sqlite exposes _array
            resolve(rows);
          },
          (_tx: any, err: any) => {
            reject(err);
            return false;
          }
        );
      },
      (err: any) => reject(err)
    );
  });
}
