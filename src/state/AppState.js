// src/state/AppState.js
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';


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
  const loaded = action.payload || {};
  return {
    ...state,
    ...loaded,
    accounts: loaded.accounts ?? [],
    transactions: loaded.transactions ?? [],
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

// ---- Budget alert helpers ----
const pad2 = (n) => String(n).padStart(2, '0');
const thisMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; // YYYY-MM
};
const prevMonthStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

// Sum of expenses for a category in a month (from an array of txns)
function spentForMonth(txns, category, month) {
  const cat = (category || 'Uncategorized').trim();
  let s = 0;
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    if (!t.date || !t.date.startsWith(month)) continue;
    const c = (t.category || 'Uncategorized').trim();
    if (c === cat) s += Number(t.amount || 0);
  }
  return s;
}

// Effective limit for category this month (base + optional rollover)
function effectiveLimitFor(state, category) {
  const cat = (category || 'Uncategorized').trim();
  const thisM = thisMonthStr();
  const prevM = prevMonthStr();

  const budgets = state?.budgets || [];

  // Base limit (sum of this month's and month-less budgets for this category)
  let base = 0;
  for (const b of budgets) {
    const m = b.month || thisM;
    if (m !== thisM) continue;
    if ((b.category || 'Uncategorized').trim() === cat) {
      base += Number(b.limit || 0);
    }
  }

  if (!state?.prefs?.budgetRollover) return { base, carry: 0, effective: base };

  // Rollover = max(0, prev limit - prev spent)
  let prevLimit = 0;
  for (const b of budgets) {
    const m = b.month || thisM;
    if (m !== prevM) continue;
    if ((b.category || 'Uncategorized').trim() === cat) {
      prevLimit += Number(b.limit || 0);
    }
  }
  const prevSpent = spentForMonth(state?.transactions || [], cat, prevM);
  const carry = Math.max(0, prevLimit - prevSpent);

  return { base, carry, effective: base + carry };
}

// Fire local notification now
async function notifyBudgetCrossed(category, pct, spent, effective, currencyPrefs) {
  const percent = Math.round(pct * 100);
  const title = `Budget at ${percent}%: ${category}`;
  const body = `Spent ${spent.toFixed(2)} of ${effective.toFixed(2)}. Tap to review.`;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { screen: 'Budgets', category } },
    trigger: null, // immediate
  });
}


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
    const tx = (state?.transactions ?? []).filter(t => t.accountId === accountId);
    let inc = 0, exp = 0;
    for (const t of tx) {
      const a = Number(t.amount || 0);
      if (t.type === 'income') inc += a; else exp += a;
    }
    return inc - exp;
  },
}), [state?.transactions]);

  
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
  // build final tx (id + payload)
  const t = { id: genId('txn'), ...tx };

  // ---- Real-time alert check (pre-dispatch) ----
  try {
    const notif = state?.prefs?.notifications || {};
    if (notif.enabled && t.type === 'expense' && t.date?.startsWith(thisMonthStr())) {
      const cat = (t.category || 'Uncategorized').trim();
      const { effective } = effectiveLimitFor(state, cat);
      if (effective > 0) {
        const spentBefore = spentForMonth(state?.transactions || [], cat, thisMonthStr());
        const spentAfter = spentBefore + Number(t.amount || 0);
        const th = typeof notif.threshold === 'number' ? notif.threshold : 0.8;

        // Alert when crossing upwards over the threshold (avoid repeated pings)
        const wasBelow = spentBefore / effective < th;
        const nowAtOrAbove = spentAfter / effective >= th;
        if (wasBelow && nowAtOrAbove) {
          await notifyBudgetCrossed(cat, spentAfter / effective, spentAfter, effective, state?.prefs);
        }
      }
    }
  } catch (e) {
    console.warn('[alerts] addTransaction check failed', e);
  }

  // ---- Persist state update ----
  const next = reducer(state, { type: 'UPSERT_TRANSACTION', payload: t });
  dispatch({ type: 'UPSERT_TRANSACTION', payload: t });
  await persist(next);
  return t;
},

updateTransaction: async (tx) => {
  // ---- Real-time alert check (pre-dispatch) ----
  try {
    const notif = state?.prefs?.notifications || {};
    if (notif.enabled && tx.type === 'expense' && tx.date?.startsWith(thisMonthStr())) {
      const cat = (tx.category || 'Uncategorized').trim();
      const { effective } = effectiveLimitFor(state, cat);
      if (effective > 0) {
        // compute spentBefore by removing the old version of this txn (if exists), then adding the new
        const txns = state?.transactions || [];
        const old = txns.find((x) => x.id === tx.id);
        const month = thisMonthStr();
        let spentBefore = 0;
        for (const t0 of txns) {
          if (t0.type !== 'expense') continue;
          if (!t0.date || !t0.date.startsWith(month)) continue;
          const c0 = (t0.category || 'Uncategorized').trim();
          if (c0 !== cat) continue;
          // exclude the old version amount if it's the same txn id
          if (old && t0.id === old.id) continue;
          spentBefore += Number(t0.amount || 0);
        }
        const spentAfter = spentBefore + Number(tx.amount || 0);
        const th = typeof notif.threshold === 'number' ? notif.threshold : 0.8;

        const wasBelow = spentBefore / effective < th;
        const nowAtOrAbove = spentAfter / effective >= th;
        if (wasBelow && nowAtOrAbove) {
          await notifyBudgetCrossed(cat, spentAfter / effective, spentAfter, effective, state?.prefs);
        }
      }
    }
  } catch (e) {
    console.warn('[alerts] updateTransaction check failed', e);
  }

  // ---- Persist state update ----
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
