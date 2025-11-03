// src/state/AppProvider.tsx
import React from 'react';

type Props = { children: React.ReactNode };

export const AppContext = React.createContext<any>({});

export function useApp() {
  return React.useContext(AppContext);
}

export default function AppProvider({ children }: Props) {
  // no useEffect/useState here – just a plain provider
  return (
    <AppContext.Provider value={{}}>
      {children}
    </AppContext.Provider>
  );
}


