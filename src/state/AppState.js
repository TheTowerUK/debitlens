// src/state/AppState.js
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ----------------------------
// Storage keys
// ----------------------------
const STORAGE_KEY = '@base44_app_state_v1';
const PIN_KEY     = '@base44_app_pin';

// ----------------------------
// Helpers
// ----------------------------
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);

// Compute account balance from global transactions
function computeBalance(transactions, accountId) {
  let bal = 0;
  for (const t of transactions) {
    if (t.accountId !== accountId) continue;
    const amt = Number(t.amount || 0);
    bal += t.type === 'expense' ? -amt : amt;
  }
  return bal;
}

// ----------------------------
// Initial state
// ----------------------------
const initialState = {
  isLoading: true,      // SplashAuthScreen waits for this to be false
  user: null,           // { id, name, email } or null
  accounts: [],         // [{ id, name, type }]
  transactions: [],     // [{ id, accountId, accountName?, date:"YYYY-MM-DD", amount, type:"income"|"expense", category, note? }]
  prefs: {
    useBiometrics: true,
    theme: 'dark',      // 'dark' | 'light'
  },
  lastSync: null,       // ISO
};

// ----------------------------
// Reducer
// ----------------------------
function reducer(state, action) {
  switch (action.type) {
    case 'BOOTSTRAP_DONE': {
      // tolerate missing prefs from older payloads
      const incoming = action.payload || {};
      const prefs = { ...initialState.prefs, ...(incoming.prefs || {}) };
      return { ...state, ...incoming, prefs, isLoading: false };
    }

    case 'SIGN_IN':
      return { ...state, user: action.payload.user };

    case 'SIGN_OUT':
      return { ...state, user: null };

    case 'SET_ACCOUNTS':
      return { ...state, accounts: Array.isArray(action.payload) ? action.payload : [] };

    case 'SET_TRANSACTIONS':
      return { ...state, transactions: Array.isArray(action.payload) ? action.payload : [] };

    case 'ADD_ACCOUNT':
      return { ...state, accounts: [action.payload, ...state.accounts] };

    case 'ADD_TXN':
      return { ...state, transactions: [action.payload, ...state.transactions] };

    case 'UPDATE_TXN': {
      const { id, patch } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map(t => (t.id === id ? { ...t, ...patch } : t)),
      };
    }

    case 'DELETE_TXN':
      return { ...state, transactions: state.transactions.filter(t => t.id !== action.payload.id) };

    case 'UPDATE_PREFS':
      return { ...state, prefs: { ...state.prefs, ...(action.payload || {}) } };

    default:
      return state;
  }
}

// ----------------------------
// Context
// ----------------------------
const AppContext = createContext(null);

// ----------------------------
// Provider
// ----------------------------
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // boolean used by SplashAuthScreen
  const isHydrated = !state.isLoading;

  // Persist selected fields to storage
  async function persist(next) {
    try {
      const payload = {
        user: next.user,
        accounts: next.accounts,
        transactions: next.transactions,
        prefs: next.prefs,
        lastSync: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[AppState] persist error', e);
    }
  }

  // PIN helpers for SplashAuthScreen + Settings
  async function getPinRaw() {
    try { return await AsyncStorage.getItem(PIN_KEY); } catch { return null; }
  }
  async function setPinRaw(pin) {
    try { await AsyncStorage.setItem(PIN_KEY, String(pin)); } catch {}
  }
  async function clearPinRaw() {
    try { await AsyncStorage.removeItem(PIN_KEY); } catch {}
  }

  // Bootstrap from storage (or seed demo)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (alive && raw) {
          const parsed = JSON.parse(raw);
          dispatch({ type: 'BOOTSTRAP_DONE', payload: parsed });
        } else {
          const demo = seedDemo();
          if (alive) {
            dispatch({ type: 'BOOTSTRAP_DONE', payload: demo });
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
          }
        }
      } catch (e) {
        console.warn('[AppState] bootstrap error', e);
        if (alive) dispatch({ type: 'BOOTSTRAP_DONE', payload: initialState });
      }
    })();
    return () => { alive = false; };
  }, []);

  // Actions (persist after each change)
  const actions = useMemo(() => {
    return {
      // Auth
      async signIn({ name, email, remember = true }) {
        const user = { id: uid(), name: name || 'User', email: email || '' };
        const next = reducer(state, { type: 'SIGN_IN', payload: { user } });
        dispatch({ type: 'SIGN_IN', payload: { user } });
        if (remember) await persist(next);
      },

      async signOut() {
        const next = reducer(state, { type: 'SIGN_OUT' });
        dispatch({ type: 'SIGN_OUT' });
        await persist(next);
      },

      // Accounts
      async setAccounts(accounts) {
        const next = reducer(state, { type: 'SET_ACCOUNTS', payload: accounts });
        dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
        await persist(next);
      },

      async addAccount(name, type = 'current') {
        const acc = { id: uid(), name: String(name || 'Account'), type };
        const next = reducer(state, { type: 'ADD_ACCOUNT', payload: acc });
        dispatch({ type: 'ADD_ACCOUNT', payload: acc });
        await persist(next);
        return acc;
      },

      // Transactions
      async setTransactions(transactions) {
        const next = reducer(state, { type: 'SET_TRANSACTIONS', payload: transactions });
        dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
        await persist(next);
      },

      async addTransaction(txn) {
        const account = (state.accounts || []).find(a => a.id === txn.accountId);
        const safeTxn = {
          id: uid(),
          accountId: txn.accountId,
          accountName: txn.accountName || account?.name,
          date: txn.date || todayISO(),
          amount: Math.abs(Number(txn.amount || 0)),
          type: txn.type === 'expense' ? 'expense' : 'income',
          category: txn.category || (txn.type === 'expense' ? 'General' : 'Income'),
          note: txn.note || '',
        };
        const next = reducer(state, { type: 'ADD_TXN', payload: safeTxn });
        dispatch({ type: 'ADD_TXN', payload: safeTxn });
        await persist(next);
      },

      async updateTransaction(id, patch) {
        const next = reducer(state, { type: 'UPDATE_TXN', payload: { id, patch } });
        dispatch({ type: 'UPDATE_TXN', payload: { id, patch } });
        await persist(next);
      },

      async deleteTransaction(id) {
        const next = reducer(state, { type: 'DELETE_TXN', payload: { id } });
        dispatch({ type: 'DELETE_TXN', payload: { id } });
        await persist(next);
      },

      // Preferences
      async updatePrefs(patch) {
        const next = reducer(state, { type: 'UPDATE_PREFS', payload: patch });
        dispatch({ type: 'UPDATE_PREFS', payload: patch });
        await persist(next);
      },

      // Utilities
      async clearAll() {
        try {
          await AsyncStorage.removeItem(STORAGE_KEY);
        } finally {
          dispatch({ type: 'BOOTSTRAP_DONE', payload: { ...initialState, isLoading: false } });
        }
      },

      async seedDemo() {
        const demo = seedDemo();
        dispatch({ type: 'BOOTSTRAP_DONE', payload: demo });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Selectors (derived values)
  const selectors = useMemo(() => {
    return {
      accountBalance(accountId) {
        return computeBalance(state.transactions, accountId);
      },
      totalNet() {
        return (state.accounts || []).reduce(
          (sum, a) => sum + computeBalance(state.transactions, a.id),
          0
        );
      },
    };
  }, [state.transactions, state.accounts]);

  const value = useMemo(() => ({
    state,
    dispatch,
    actions,
    selectors,

    // used by SplashAuthScreen + Settings
    isHydrated,
    getPin: getPinRaw,
    setPin: setPinRaw,
    clearPin: clearPinRaw,
  }), [state, actions, selectors, isHydrated]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ----------------------------
// Hook
// ----------------------------
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ----------------------------
// Demo seed
// ----------------------------
function seedDemo() {
  const acc1 = { id: uid(), name: 'Main Account', type: 'current' };
  const acc2 = { id: uid(), name: 'Savings', type: 'savings' };

  const txns = [
    { id: uid(), accountId: acc1.id, accountName: acc1.name, date: todayISO(), amount: 2500, type: 'income',  category: 'Salary',   note: 'Monthly pay' },
    { id: uid(), accountId: acc1.id, accountName: acc1.name, date: todayISO(), amount:   65, type: 'expense', category: 'Groceries', note: 'Supermarket' },
    { id: uid(), accountId: acc1.id, accountName: acc1.name, date: todayISO(), amount:   40, type: 'expense', category: 'Transport', note: 'Fuel' },
    { id: uid(), accountId: acc2.id, accountName: acc2.name, date: todayISO(), amount:  200, type: 'income',  category: 'Transfer',  note: 'Move to savings' },
  ];

  return {
    ...initialState,
    isLoading: false,
    user: null,
    accounts: [acc1, acc2],
    transactions: txns,
    prefs: { ...initialState.prefs },
    lastSync: new Date().toISOString(),
  };
}
