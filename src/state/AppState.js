// src/state/AppState.js
import React from 'react';

export const AppContext = React.createContext({});

export default function AppProvider({ children }) {
  // put any global state here if/when you need it
  const value = {};
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
