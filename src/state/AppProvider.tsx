// src/state/AppProvider.tsx
import React from 'react';

type AppContextValue = {
  // you can add real fields later; empty for now
};

export const AppContext = React.createContext<AppContextValue | undefined>(undefined);

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  // For now, just return an empty object if undefined so callers don't crash
  return (ctx ?? {}) as AppContextValue;
}

type Props = { children: React.ReactNode };

export default function AppProvider({ children }: Props) {
  const value = React.useMemo<AppContextValue>(() => ({}), []);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
