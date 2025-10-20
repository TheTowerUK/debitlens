// src/dev/resetDb.js
import * as FileSystem from 'expo-file-system';

export async function resetDatabase() {
  const path = FileSystem.documentDirectory + 'SQLite/app.db';
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
    console.log('DB reset: deleted', path);
  } catch (e) {
    console.warn('DB reset failed', e);
  }
}
