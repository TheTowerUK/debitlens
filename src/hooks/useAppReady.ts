// src/hooks/useAppReady.ts
import { useEffect, useState } from 'react';
import { runMigrations } from 'db/migrate';

export function useAppReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await runMigrations();
        console.log('DB migrations complete');
        setReady(true);
      } catch (e) {
        console.warn('DB migration error', e);
      }
    })();
  }, []);

  return ready;
}
