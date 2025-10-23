import React from 'react';

export const AppContext = React.createContext({});

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (ctx === undefined) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export default function AppProvider({ children }) {
  // IMPORTANT: Hooks are only inside the component — no top-level hooks anywhere
  const value = React.useMemo(() => ({
    state: {
      prefs: { notifications: { enabled: false, dailyTime: '09:00' } },
    },
    actions: {
      setPrefs: async () => {},
    },
    user: null,
  }), []);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
