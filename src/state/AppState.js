// src/state/AppState.js
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * AppState responsibilities:
 * - Persist accounts + transactions to AsyncStorage
 * - Compute balances (per-account + total)
 * - CRUD: accounts and transactions
 * - PIN storage (for biometric fallback) via SecureStore
 *
 * Notes:
 * - Negative amounts = outgoings; positive = income
 * - Change STORAGE_KEY version if you change the stored shape (simple migration guard)
 */

const AppCtx = createContext(null);

// ---------- Config ----------
const STORAGE_KEY = 'app/accounts/v1';
const PIN_KEY = 'app/pin/v1';

// ---------- Utils ----------
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

const initialState = {
  isLoading: false,
  user: null,
  accounts: [],
  transactions: [],
};
// ---------- Provider ----------
export function AppProvider({ children }) {
  // Seed demo data; will be replaced on hydration if storage has data
  console.log('[AppProvider] mounted');
  const [accounts, setAccounts] = useState([
    {
      id: 'acc1',
      name: 'Main',
      currency: '£',
      transactions: [
        { id: 't1', amount: 2100.0, note: 'Salary', ts: Date.now() - 86400000 * 8 },
        { id: 't2', amount: -950.0, note: 'Rent', ts: Date.now() - 86400000 * 6 },
        { id: 't3', amount: -42.5, note: 'Coffee', ts: Date.now() - 86400000 * 1 },
      ],
    },
    { id: 'acc2', name: 'Savings', currency: '£', transactions: [{ id: 't4', amount: 300.0, note: 'Top-up', ts: Date.now() - 86400000 * 3 }] },
  ]);

  const [state, setState] = React.useState(initialState);
  // console.log('[AppProvider] mounted');
  return (
    <AppContext.Provider value={{ state, setState }}>
      {children}
    </AppContext.Provider>
  );

  const [isHydrated, setIsHydrated] = useState(false);

  // ---------- Hydration ----------
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setAccounts(parsed);
            } else {
              console.warn('Stored accounts were not an array; keeping seed.');
            }
          } catch (e) {
            console.warn('Failed to parse stored accounts; keeping seed.', e);
          }
        }
      } catch (e) {
        console.warn('Hydration failed', e);
      } finally {
        // ALWAYS finish hydration so the splash screen can proceed
        setIsHydrated(true);
      }
    })();
  }, []);

  // ---------- Persistence ----------
  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)).catch((e) => {
      console.warn('Persist failed', e);
    });
  }, [accounts, isHydrated]);

  // ---------- Selectors ----------
  const getAccount = (accountId) => accounts.find((a) => a.id === accountId);

  const balanceOf = (accountId) => {
    const acc = getAccount(accountId);
    if (!acc?.transactions?.length) return 0;
    return sum(acc.transactions.map((t) => Number(t.amount) || 0));
  };

  const totalBalance = useMemo(() => sum(accounts.map((a) => balanceOf(a.id))), [accounts]);

  // ---------- Mutators ----------
  const createAccount = (name, currency = '£') => {
    const acc = {
      id: `acc${Date.now()}`,
      name: name?.trim() || 'Account',
      currency,
      transactions: [],
    };
    setAccounts((prev) => [acc, ...prev]);
    return acc.id;
  };

  const renameAccount = (accountId, newName) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, name: newName?.trim() || a.name } : a)),
    );
  };

  const removeAccount = (accountId) => {
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
  };

  const addTransaction = (accountId, { amount, note }) => {
    const tx = {
      id: `t${Date.now()}`,
      amount: Number(amount),
      note: note?.trim() || '',
      ts: Date.now(),
    };
    if (Number.isNaN(tx.amount) || !tx.amount) return;
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, transactions: [tx, ...(a.transactions || [])] } : a)),
    );
  };

  const removeTransaction = (accountId, txId) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, transactions: (a.transactions || []).filter((t) => t.id !== txId) } : a,
      ),
    );
  };

  // ---------- PIN (for Splash/Auth fallback) ----------
  const setPin = async (pin) => {
    await SecureStore.setItemAsync(PIN_KEY, String(pin));
  };

  const getPin = async () => {
    return (await SecureStore.getItemAsync(PIN_KEY)) || null;
  };

  // ---------- Value ----------
  const value = useMemo(
    () => ({
      // lifecycle
      isHydrated,

      // data
      accounts,
      totalBalance,

      // selectors
      getAccount,
      balanceOf,

      // account ops
      createAccount,
      renameAccount,
      removeAccount,

      // tx ops
      addTransaction,
      removeTransaction,

      // pin ops
      setPin,
      getPin,
    }),
    [isHydrated, accounts, totalBalance],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// ---------- Hook ----------
export const useApp = () => {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
