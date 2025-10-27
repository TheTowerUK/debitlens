// src/state/AppProvider.tsx
import React, { useEffect, useState } from 'react';
import { runMigrations as runMigrations } from 'db/migrate';


type Props = { children: React.ReactNode };

export function AppProvider({ children }: Props) {
  //useEffect(() => {
    //(async () => {
      //try {
        //await runMigrations();
        //console.log('DB migrations complete');
      //} catch (e) {
        //console.warn('DB migration error', e);
      //}
    //})();
  //}, []);

  // ...your existing context/provider logic can stay here
  return <>{children}</>;
}

export default AppProvider;

