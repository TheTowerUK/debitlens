// src/state/AppProvider.tsx
import React from 'react';

type AppContextValue = {
  // add anything you need later; for now it's just a placeholder
};

export const AppContext = React.createContext<AppContextValue | undefined>(undefined);

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  // For debugging we just return an empty object instead of throwing
  return (ctx ?? {}) as AppContextValue;
}

type Props = {
  children: React.ReactNode;
};

export default function AppProvider({ children }: Props) {
  // 👇 NO useState, NO useEffect, NOTHING fancy here
  const value = React.useMemo<AppContextValue>(() => ({}), []);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
