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
  recurring: [],                // [{ id, accountId, type, amount, category, note, freq, startDate, endDate?, autoPost }]
  lastRecurringRun: null,       // 'YYYY-MM-DD' of the last generation pass

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
    case 'SET_RECURRING': {
      return { ...state, recurring: action.payload };
    }
    case 'ADD_RECURRING': {
      return { ...state, recurring: [...(state.recurring || []), action.payload] };
    }
    case 'UPDATE_RECURRING': {
      const r = action.payload;
      return {
        ...state,
        recurring: (state.recurring || []).map(x => x.id === r.id ? r : x),
      };
    }
    case 'DELETE_RECURRING': {
      const id = action.payload;
      return {
        ...state,
        recurring: (state.recurring || []).filter(x => x.id !== id),
      };
    }
    case 'SET_LAST_RECURRING_RUN': {
      return { ...state, lastRecurringRun: action.payload || null };
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

// Fire local notification now (dynamic import to avoid Expo Go push warnings on load)
async function notifyBudgetCrossed(category, pct, spent, effective) {
  const Notifications = await import('expo-notifications');
  const percent = Math.round(pct * 100);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Budget at ${percent}%: ${category}`,
      body: `Spent ${spent.toFixed(2)} of ${effective.toFixed(2)}. Tap to review.`,
      data: { screen: 'Budgets', category },
    },
    trigger: null,
  });
}


// ----- Recurring helpers -----
const isoToday = () => new Date().toISOString().slice(0,10);
const parseISO = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))) return null;
  const [y,m,d] = s.split('-').map(n=>parseInt(n,10));
  return new Date(y, m-1, d);
};
const toISO = (d) => {
  const pad = (n)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

function* dateRangeDays(startISO, endISO) {
  const s = parseISO(startISO); const e = parseISO(endISO);
  if (!s || !e || s>e) return;
  for (let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) {
    yield toISO(d);
  }
}

function isDueOn(rule, iso) {
  // respect start/end
  if (rule.startDate && iso < rule.startDate) return false;
  if (rule.endDate && iso > rule.endDate) return false;

  const start = parseISO(rule.startDate || iso);
  const cur = parseISO(iso);
  if (!start || !cur) return false;

  const freq = rule.freq || 'monthly';
  if (freq === 'daily') return true;

  if (freq === 'weekly') {
    return start.getDay() === cur.getDay(); // same weekday as start
  }

  if (freq === 'monthly') {
    // run on same day-of-month as start; clamp if month shorter
    const want = start.getDate();
    return cur.getDate() === want;
  }

  return false;
}

function txKey(t) {
  // identity key to avoid duplicates: originRecurringId|date|amount|account
  return [t.originRecurringId, t.date, t.amount, t.accountId, t.type, t.category || '', t.note || ''].join('|');
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
    
    // Recurring CRUD
setRecurring: async (items) => {
  const next = reducer(state, { type: 'SET_RECURRING', payload: items });
  dispatch({ type: 'SET_RECURRING', payload: items });
  await persist(next);
},
addRecurring: async (item) => {
  const r = { id: genId('recur'), autoPost: true, freq: 'monthly', ...item };
  const next = reducer(state, { type: 'ADD_RECURRING', payload: r });
  dispatch({ type: 'ADD_RECURRING', payload: r });
  await persist(next);
  return r;
},
updateRecurring: async (item) => {
  const next = reducer(state, { type: 'UPDATE_RECURRING', payload: item });
  dispatch({ type: 'UPDATE_RECURRING', payload: item });
  await persist(next);
},
deleteRecurring: async (id) => {
  const next = reducer(state, { type: 'DELETE_RECURRING', payload: id });
  dispatch({ type: 'DELETE_RECURRING', payload: id });
  await persist(next);
},

// Generator: posts any due items between last run and today (inclusive)
runRecurringGeneration: async () => {
  try {
    const today = isoToday();
    const last = state.lastRecurringRun || today; // first time → only today
    const rules = state.recurring || [];
    if (!rules.length) {
      // still stamp the run
      const stamped = reducer(state, { type: 'SET_LAST_RECURRING_RUN', payload: today });
      dispatch({ type: 'SET_LAST_RECURRING_RUN', payload: today });
      await persist(stamped);
      return;
    }

    // Build a set of existing keys to prevent duplicates
    const existingKeys = new Set((state.transactions || []).map(txKey));

    const newTxns = [];
    for (const d of dateRangeDays(last, today)) {
      for (const r of rules) {
        if (!r.autoPost) continue;
        if (!isDueOn(r, d)) continue;
        const t = {
          id: genId('txn'),
          originRecurringId: r.id,
          accountId: r.accountId,
          type: r.type,                 // 'expense' | 'income'
          amount: Number(r.amount || 0),
          date: d,                      // due date
          category: r.category || (r.type === 'expense' ? 'General' : 'Income'),
          note: r.note || 'Recurring',
        };
        if (t.amount <= 0 || !t.accountId) continue;
        const key = txKey(t);
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          newTxns.push(t);
        }
      }
    }

    if (newTxns.length) {
      const merged = [...(state.transactions || []), ...newTxns];
      let next = reducer(state, { type: 'SET_TRANSACTIONS', payload: merged });
      dispatch({ type: 'SET_TRANSACTIONS', payload: merged });
      next = reducer(next, { type: 'SET_LAST_RECURRING_RUN', payload: today });
      dispatch({ type: 'SET_LAST_RECURRING_RUN', payload: today });
      await persist(next);
    } else {
      const next = reducer(state, { type: 'SET_LAST_RECURRING_RUN', payload: today });
      dispatch({ type: 'SET_LAST_RECURRING_RUN', payload: today });
      await persist(next);
    }
  } catch (e) {
    console.warn('[recurring] generation failed', e);
  }
},

    
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
