// src/dev/resetDb.ts
import * as FileSystem from 'expo-file-system';

export async function resetDatabase(): Promise<void> {
  const dir = (FileSystem as any).documentDirectory as string | null | undefined;
  if (!dir) {
    console.warn('resetDatabase: expo-file-system.documentDirectory is not available at runtime');
    return;
  }

  const path = dir + 'SQLite/app.db';
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
    console.log('DB reset: deleted', path);
  } catch (e) {
    console.warn('DB reset failed', e);
  }
}
