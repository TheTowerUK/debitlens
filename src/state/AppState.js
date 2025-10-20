// src/state/AppState.js
import React from 'react';

// 1) Context
export const AppContext = React.createContext({});

// 2) Hook (this is what Dashboard calls)
export function useApp() {
  const ctx = React.useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside <AppProvider>');
  }
  return ctx;
}

// 3) Provider (default export)
export default function AppProvider({ children }) {
  // Keep it minimal for now; add real state later
  const value = React.useMemo(() => ({
    // put any globals you actually use in screens here
    // e.g. user, theme, accounts, refresh, etc.
    user: null,
  }), []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
