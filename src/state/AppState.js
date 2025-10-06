// src/state/AppState.js
import { createContext, useContext, useMemo, useState } from 'react';

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [balance, setBalance] = useState(1523.76);
  const [payments, setPayments] = useState([
    { id: 'p1', payee: 'Coffee Roasters', amount: -4.2, createdAt: '2025-10-05T10:30:00Z' },
    { id: 'p2', payee: 'Salary', amount: 2100.0, createdAt: '2025-09-28T09:00:00Z' }
  ]);

  const addPayment = (payee, amount) => {
    const id = `p${Date.now()}`;
    const createdAt = new Date().toISOString();
    setPayments(prev => [{ id, payee, amount, createdAt }, ...prev]);
    setBalance(prev => prev + amount); // negative = outgoing
  };

  const value = useMemo(() => ({ balance, payments, addPayment }), [balance, payments]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
