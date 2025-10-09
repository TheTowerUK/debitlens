// src/state/AppState.js
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ---------- Persistence keys ----------
const STORAGE_KEY = '@base44/state/v1';
const PIN_KEY     = 'base44_app_pin';

// ---------- Utilities ----------
const genId = (p = 'id') => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// ---------- Initial State ----------
const initialState = {
  isHydrated: false,

  accounts: [],         // [{ id, name, kind? }]
  transactions: [],     // [{ id, accountId, type: 'income'|'expense', amount, date:'YYYY-MM-DD', category?, note? }]
  budgets: [],          // [{ id, category, limit:number, month:'YYYY-MM' | undefined }]

  prefs: {
    useBiometrics: true,
    theme: 'dark',
    currencyCode: 'GBP',
    notifications: {
      // your app can put switches / times here if needed
    },
  },

  // optional: last sync timestamp if you later add cloud sync
  lastSync: null,

  // Busget Rollover
  budgetRollover: false, // 👈 NEW: global on/off

};

// ---------- Reducer ----------
function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      // ensure new keys exist even if older storage is loaded
      const loaded = action.payload || {};
      return {
        ...state,
        ...loaded,
        budgets: loaded.budgets ?? [],
        prefs: { ...initialState.prefs, ...(loaded.prefs || {}) },
        isHydrated: true,
      };
    }

    // Accounts
    case 'SET_ACCOUNTS': {
      return { ...state, accounts: action.payload };
    }
    case 'ADD_ACCOUNT': {
      return { ...state, accounts: [...state.accounts, action.payload] };
    }

    // Transactions
    case 'SET_TRANSACTIONS': {
      return { ...state, transactions: action.payload };
    }
    case 'UPSERT_TRANSACTION': {
      const t = action.payload;
      const exists = state.transactions.some(x => x.id === t.id);
      return {
        ...state,
        transactions: exists
          ? state.transactions.map(x => (x.id === t.id ? t : x))
          : [...state.transactions, t],
      };
    }
    case 'DELETE_TRANSACTION': {
      const id = action.payload;
      return { ...state, transactions: state.transactions.filter(t => t.id !== id) };
    }

    // Budgets
    case 'SET_BUDGETS': {
      return { ...state, budgets: action.payload };
    }
    case 'ADD_BUDGET': {
      return { ...state, budgets: [...(state.budgets || []), action.payload] };
    }
    case 'DELETE_BUDGET': {
      const id = action.payload;
      return { ...state, budgets: (state.budgets || []).filter(b => b.id !== id) };
    }

    // Prefs
    case 'UPDATE_PREFS': {
      return { ...state, prefs: { ...state.prefs, ...(action.payload || {}) } };
    }

    case 'SIGN_OUT': {
      // Clear volatile data but keep a minimal structure (you can tweak)
      return {
        ...initialState,
        isHydrated: true, // remain hydrated to avoid splash loop
      };
    }

    default:
      return state;
  }
}

// ---------- Context ----------
const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist the whole app state (except isHydrated) to AsyncStorage
  const persist = async (nextState) => {
    try {
      const toSave = { ...nextState };
      delete toSave.isHydrated;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[persist] failed', e);
    }
  };

  // Hydrate on mount
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!canceled) {
          dispatch({ type: 'HYDRATE', payload: parsed || {} });
        }
      } catch (e) {
        console.warn('[hydrate] failed', e);
        if (!canceled) dispatch({ type: 'HYDRATE', payload: {} });
      }
    })();
    return () => { canceled = true; };
  }, []);

  // ---------- Selectors ----------
  const selectors = useMemo(() => ({
    accountBalance: (accountId) => {
      const tx = (state.transactions || []).filter(t => t.accountId === accountId);
      let inc = 0, exp = 0;
      for (const t of tx) {
        const a = Number(t.amount || 0);
        if (t.type === 'income') inc += a; else exp += a;
      }
      return inc - exp;
    },
  }), [state.transactions]);

  // ---------- Actions ----------
  const actions = useMemo(() => ({
    // Accounts
    addAccount: async (name, kind = 'current') => {
      const account = { id: genId('acc'), name, kind };
      const next = reducer(state, { type: 'ADD_ACCOUNT', payload: account });
      dispatch({ type: 'ADD_ACCOUNT', payload: account });
      await persist(next);
      return account;
    },
    setAccounts: async (accounts) => {
      const next = reducer(state, { type: 'SET_ACCOUNTS', payload: accounts });
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
      await persist(next);
    },

    // Transactions
    setTransactions: async (transactions) => {
      const next = reducer(state, { type: 'SET_TRANSACTIONS', payload: transactions });
      dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
      await persist(next);
    },
    addTransaction: async (tx) => {
      const t = { id: genId('txn'), ...tx };
      const next = reducer(state, { type: 'UPSERT_TRANSACTION', payload: t });
      dispatch({ type: 'UPSERT_TRANSACTION', payload: t });
      await persist(next);
      return t;
    },
    updateTransaction: async (tx) => {
      const next = reducer(state, { type: 'UPSERT_TRANSACTION', payload: tx });
      dispatch({ type: 'UPSERT_TRANSACTION', payload: tx });
      await persist(next);
    },
    deleteTransaction: async (id) => {
      const next = reducer(state, { type: 'DELETE_TRANSACTION', payload: id });
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
      await persist(next);
    },

    // Budgets
    setBudgets: async (budgets) => {
      const next = reducer(state, { type: 'SET_BUDGETS', payload: budgets });
      dispatch({ type: 'SET_BUDGETS', payload: budgets });
      await persist(next);
    },
    addBudget: async (budget) => {
      const b = { id: genId('b'), ...budget };
      const next = reducer(state, { type: 'ADD_BUDGET', payload: b });
      dispatch({ type: 'ADD_BUDGET', payload: b });
      await persist(next);
      return b;
    },
    deleteBudget: async (id) => {
      const next = reducer(state, { type: 'DELETE_BUDGET', payload: id });
      dispatch({ type: 'DELETE_BUDGET', payload: id });
      await persist(next);
    },

    // Prefs
    updatePrefs: async (partial) => {
      const next = reducer(state, { type: 'UPDATE_PREFS', payload: partial });
      dispatch({ type: 'UPDATE_PREFS', payload: partial });
      await persist(next);
    },

    // Auth-ish
    signOut: async () => {
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {}
      dispatch({ type: 'SIGN_OUT' });
    },

    // PIN helpers (used by SplashAuthScreen)
    getPin: async () => {
      try {
        const v = await SecureStore.getItemAsync(PIN_KEY);
        return v || null;
      } catch {
        return null;
      }
    },
    setPin: async (pin) => {
      await SecureStore.setItemAsync(PIN_KEY, String(pin));
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state]); // depend on state so persist(next) uses latest base

  const value = useMemo(() => ({ state, dispatch, actions, selectors, isHydrated: state.isHydrated }), [state, actions, selectors]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

// ---------- Hook ----------
export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
