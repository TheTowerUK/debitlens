// src/state/AppState.js
import React from 'react';

// context
export const AppContext = React.createContext({});

// named hook (some screens call this)
export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

// default provider (no async/await, no side effects)
export default function AppProvider({ children }) {
  const value = React.useMemo(() => ({
    // add fields here later as screens need them
    user: null,
  }), []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
