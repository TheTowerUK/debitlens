// src/state/AppState.js
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ------------------------------
// Small helpers
// ------------------------------
const STORAGE_KEY = 'DebitLens_app_state_v1';
const PIN_KEY = 'DebitLens_app_pin_v1';

const genId = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const asId = (x) => String(x ?? '');
const pad2 = (n) => String(n).padStart(2, '0');

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const ymOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const thisMonthStr = () => ymOf(new Date());
const prevMonthStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return ymOf(d);
};

// ------------------------------
// Initial state (seed demo data)
// ------------------------------
const initialState = {
  isHydrated: false,

  accounts: [{ id: 'acct_default', name: 'Main', type: 'current' }],

  transactions: [
    {
      id: 'txn_seed_1',
      accountId: 'acct_default',
      type: 'income',
      amount: 1000,
      date: todayISO(),
      category: 'Income',
      note: 'Seed',
    },
  ],

  budgets: [{ id: 'b_1', category: 'Groceries', limit: 300, month: thisMonthStr() }],

  recurring: [],
  lastRecurringRun: null,

  prefs: {
    currency: 'GBP',
    currencySymbol: '£',
    budgetRollover: true,
    notifications: { enabled: true, threshold: 0.8, dailyTime: '09:00' },
  },
};

// ------------------------------
// Reducer
// ------------------------------
function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE': {
      const loaded = action.payload || {};
      const accounts = (loaded.accounts ?? []).map((a) => ({ ...a, id: asId(a.id) }));
      const transactions = (loaded.transactions ?? []).map((t) => ({
        ...t,
        id: asId(t.id),
        accountId: asId(t.accountId),
      }));
      const budgets = (loaded.budgets ?? []).map((b) => ({ ...b, id: asId(b.id) }));
      const recurring = (loaded.recurring ?? []).map((r) => ({
        ...r,
        id: asId(r.id),
        accountId: asId(r.accountId),
      }));
      return {
        ...state,
        ...loaded,
        accounts: accounts.length ? accounts : initialState.accounts,
        transactions,
        budgets,
        recurring,
        prefs: { ...initialState.prefs, ...(loaded.prefs || {}) },
        isHydrated: true,
      };
    }

    // Accounts
    case 'SET_ACCOUNTS': {
      const list = (action.payload || []).map((a) => ({ ...a, id: asId(a.id) }));
      return { ...state, accounts: list };
    }

    // Transactions
    case 'SET_TRANSACTIONS': {
      const list = (action.payload || []).map((t) => ({
        ...t,
        id: asId(t.id),
        accountId: asId(t.accountId),
      }));
      return { ...state, transactions: list };
    }
    case 'UPSERT_TRANSACTION': {
      const t = { ...(action.payload || {}) };
      const id = asId(t.id);
      const list = state.transactions ?? [];
      const idx = list.findIndex((x) => asId(x.id) === id);
      const next =
        idx === -1
          ? [...list, { ...t, id, accountId: asId(t.accountId) }]
          : list.map((x) => (asId(x.id) === id ? { ...x, ...t, id, accountId: asId(t.accountId) } : x));
      return { ...state, transactions: next };
    }
    case 'DELETE_TRANSACTION': {
      const id = asId(action.payload);
      return { ...state, transactions: (state.transactions || []).filter((x) => asId(x.id) !== id) };
    }

    // Budgets
    case 'SET_BUDGETS': {
      const list = (action.payload || []).map((b) => ({ ...b, id: asId(b.id) }));
      return { ...state, budgets: list };
    }
    case 'UPSERT_BUDGET': {
      const b = action.payload || {};
      const id = asId(b.id);
      const list = state.budgets ?? [];
      const idx = list.findIndex((x) => asId(x.id) === id);
      const next = idx === -1 ? [...list, { ...b, id }] : list.map((x) => (asId(x.id) === id ? { ...x, ...b, id } : x));
      return { ...state, budgets: next };
    }
    case 'DELETE_BUDGET': {
      const id = asId(action.payload);
      return { ...state, budgets: (state.budgets || []).filter((x) => asId(x.id) !== id) };
    }

    // Recurring
    case 'SET_RECURRING': {
      const list = (action.payload || []).map((r) => ({ ...r, id: asId(r.id), accountId: asId(r.accountId) }));
      return { ...state, recurring: list };
    }
    case 'ADD_RECURRING': {
      const r = action.payload || {};
      return { ...state, recurring: [...(state.recurring || []), { ...r, id: asId(r.id), accountId: asId(r.accountId) }] };
    }
    case 'UPDATE_RECURRING': {
      const r = action.payload || {};
      return {
        ...state,
        recurring: (state.recurring || []).map((x) =>
          asId(x.id) === asId(r.id) ? { ...x, ...r, id: asId(r.id), accountId: asId(r.accountId) } : x
        ),
      };
    }
    case 'DELETE_RECURRING': {
      const id = asId(action.payload);
      return { ...state, recurring: (state.recurring || []).filter((x) => asId(x.id) !== id) };
    }
    case 'SET_LAST_RECURRING_RUN': {
      return { ...state, lastRecurringRun: action.payload || null };
    }

    // Prefs
    case 'SET_PREFS': {
      return { ...state, prefs: { ...state.prefs, ...(action.payload || {}) } };
    }

    default:
      return state;
  }
}

// ------------------------------
// Persistence
// ------------------------------
async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function saveState(st) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  } catch {}
}

// ------------------------------
// Budget helpers (rollover + alerts)
// ------------------------------
function spentForMonth(txns, category, ym) {
  const cat = (category || 'Uncategorized').trim();
  let s = 0;
  for (const t of txns || []) {
    if (t.type !== 'expense') continue;
    if (!t.date || !t.date.startsWith(ym)) continue;
    const c = (t.category || 'Uncategorized').trim();
    if (c === cat) s += Number(t.amount || 0);
  }
  return s;
}
function effectiveLimitFor(state, category) {
  const cat = (category || 'Uncategorized').trim();
  const thisM = thisMonthStr();
  const prevM = prevMonthStr();

  // Base for this month
  let base = 0;
  for (const b of state.budgets || []) {
    const m = b.month || thisM;
    if (m !== thisM) continue;
    if ((b.category || 'Uncategorized').trim() === cat) base += Number(b.limit || 0);
  }
  if (!state?.prefs?.budgetRollover) return { base, carry: 0, effective: base };

  // Rollover from previous month
  let prevLimit = 0;
  for (const b of state.budgets || []) {
    const m = b.month || thisM;
    if (m !== prevM) continue;
    if ((b.category || 'Uncategorized').trim() === cat) prevLimit += Number(b.limit || 0);
  }
  const prevSpent = spentForMonth(state.transactions || [], cat, prevM);
  const carry = Math.max(0, prevLimit - prevSpent);
  return { base, carry, effective: base + carry };
}

async function notifyBudgetCrossed(category, pct, spent, effective) {
  try {
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
  } catch (e) {
    console.warn('[alerts] notify failed', e);
  }
}

// ------------------------------
// Recurring helpers
// ------------------------------
const parseISO = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
};
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function* dateRangeDays(startISO, endISO) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e || s > e) return;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    yield toISO(d);
  }
}
function isDueOn(rule, iso) {
  if (rule.startDate && iso < rule.startDate) return false;
  if (rule.endDate && iso > rule.endDate) return false;
  const start = parseISO(rule.startDate || iso);
  const cur = parseISO(iso);
  if (!start || !cur) return false;
  const freq = rule.freq || 'monthly';
  if (freq === 'daily') return true;
  if (freq === 'weekly') return start.getDay() === cur.getDay();
  if (freq === 'monthly') return cur.getDate() === start.getDate();
  return false;
}
function txKey(t) {
  return [
    t.originRecurringId,
    t.date,
    t.amount,
    t.accountId,
    t.type,
    t.category || '',
    t.note || '',
  ].join('|');
}

// ------------------------------
// Context
// ------------------------------
const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate on mount
  useEffect(() => {
    (async () => {
      const loaded = await loadState();
      dispatch({ type: 'HYDRATE', payload: loaded || initialState });
    })();
  }, []);

  const persist = async (next) => {
    await saveState(next);
  };

  // Actions
  const actions = useMemo(
    () => ({
      // Accounts
      setAccounts: async (accounts) => {
        const next = reducer(state, { type: 'SET_ACCOUNTS', payload: accounts });
        dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
        await persist(next);
      },
      addAccount: async (name, type = 'current') => {
        const acct = { id: genId('acct'), name: name || 'Account', type };
        const next = reducer(state, {
          type: 'SET_ACCOUNTS',
          payload: [...(state.accounts ?? []), acct],
        });
        dispatch({ type: 'SET_ACCOUNTS', payload: next.accounts });
        await persist(next);
        return acct;
      },

      // Transactions
      setTransactions: async (transactions) => {
        const next = reducer(state, { type: 'SET_TRANSACTIONS', payload: transactions });
        dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
        await persist(next);
      },
      addTransaction: async (tx) => {
        const t = { id: genId('txn'), ...tx, accountId: asId(tx.accountId) };

        // real-time budget alert (crossing threshold upward)
        try {
          const notif = state?.prefs?.notifications || {};
          if (notif.enabled && t.type === 'expense' && t.date?.startsWith(thisMonthStr())) {
            const cat = (t.category || 'Uncategorized').trim();
            const { effective } = effectiveLimitFor(state, cat);
            if (effective > 0) {
              const before = spentForMonth(state.transactions || [], cat, thisMonthStr());
              const after = before + Number(t.amount || 0);
              const th = typeof notif.threshold === 'number' ? notif.threshold : 0.8;
              if (before / effective < th && after / effective >= th) {
                await notifyBudgetCrossed(cat, after / effective, after, effective);
              }
            }
          }
        } catch (e) {
          console.warn('[alerts] addTransaction check failed', e);
        }

        const next = reducer(state, { type: 'UPSERT_TRANSACTION', payload: t });
        dispatch({ type: 'UPSERT_TRANSACTION', payload: t });
        await persist(next);
        return t;
      },
      updateTransaction: async (tx) => {
        const t = { ...tx, id: asId(tx.id), accountId: asId(tx.accountId) };

        // real-time alert for edits
        try {
          const notif = state?.prefs?.notifications || {};
          if (notif.enabled && t.type === 'expense' && t.date?.startsWith(thisMonthStr())) {
            const cat = (t.category || 'Uncategorized').trim();
            const { effective } = effectiveLimitFor(state, cat);
            if (effective > 0) {
              // recompute before excluding old version of this txn
              const txns = state.transactions || [];
              const old = txns.find((x) => asId(x.id) === asId(t.id));
              const ym = thisMonthStr();
              let before = 0;
              for (const x of txns) {
                if (x.type !== 'expense') continue;
                if (!x.date || !x.date.startsWith(ym)) continue;
                const c0 = (x.category || 'Uncategorized').trim();
                if (c0 !== cat) continue;
                if (old && asId(x.id) === asId(old.id)) continue;
                before += Number(x.amount || 0);
              }
              const after = before + Number(t.amount || 0);
              const th = typeof notif.threshold === 'number' ? notif.threshold : 0.8;
              if (before / effective < th && after / effective >= th) {
                await notifyBudgetCrossed(cat, after / effective, after, effective);
              }
            }
          }
        } catch (e) {
          console.warn('[alerts] updateTransaction check failed', e);
        }

        const next = reducer(state, { type: 'UPSERT_TRANSACTION', payload: t });
        dispatch({ type: 'UPSERT_TRANSACTION', payload: t });
        await persist(next);
      },
      deleteTransaction: async (id) => {
        const next = reducer(state, { type: 'DELETE_TRANSACTION', payload: asId(id) });
        dispatch({ type: 'DELETE_TRANSACTION', payload: asId(id) });
        await persist(next);
      },

      // Budgets
      setBudgets: async (budgets) => {
        const next = reducer(state, { type: 'SET_BUDGETS', payload: budgets });
        dispatch({ type: 'SET_BUDGETS', payload: budgets });
        await persist(next);
      },
      upsertBudget: async (b) => {
        const item = { id: asId(b.id || genId('b')), ...b };
        const next = reducer(state, { type: 'UPSERT_BUDGET', payload: item });
        dispatch({ type: 'UPSERT_BUDGET', payload: item });
        await persist(next);
        return item;
      },
      deleteBudget: async (id) => {
        const next = reducer(state, { type: 'DELETE_BUDGET', payload: asId(id) });
        dispatch({ type: 'DELETE_BUDGET', payload: asId(id) });
        await persist(next);
      },

      // Prefs
      updatePrefs: async (partial) => {
        const merged = { ...state.prefs, ...(partial || {}) };
        const next = reducer(state, { type: 'SET_PREFS', payload: merged });
        dispatch({ type: 'SET_PREFS', payload: merged });
        await persist(next);
      },

      // Recurring CRUD
      setRecurring: async (items) => {
        const next = reducer(state, { type: 'SET_RECURRING', payload: items });
        dispatch({ type: 'SET_RECURRING', payload: items });
        await persist(next);
      },
      addRecurring: async (item) => {
        const r = {
          id: genId('recur'),
          autoPost: true,
          freq: 'monthly',
          ...item,
          accountId: asId(item.accountId),
        };
        const next = reducer(state, { type: 'ADD_RECURRING', payload: r });
        dispatch({ type: 'ADD_RECURRING', payload: r });
        await persist(next);
        return r;
      },
      updateRecurring: async (item) => {
        const r = { ...item, id: asId(item.id), accountId: asId(item.accountId) };
        const next = reducer(state, { type: 'UPDATE_RECURRING', payload: r });
        dispatch({ type: 'UPDATE_RECURRING', payload: r });
        await persist(next);
      },
      deleteRecurring: async (id) => {
        const next = reducer(state, { type: 'DELETE_RECURRING', payload: asId(id) });
        dispatch({ type: 'DELETE_RECURRING', payload: asId(id) });
        await persist(next);
      },

      // Recurring generation (idempotent)
      runRecurringGeneration: async () => {
        try {
          const today = todayISO();
          const last = state.lastRecurringRun || today;
          const rules = state.recurring || [];

          const existing = new Set((state.transactions || []).map(txKey));
          const newTxns = [];

          for (const d of dateRangeDays(last, today)) {
            for (const rule of rules) {
              if (!rule.autoPost) continue;
              if (!isDueOn(rule, d)) continue;

              const t = {
                id: genId('txn'),
                originRecurringId: rule.id,
                accountId: asId(rule.accountId),
                type: rule.type,
                amount: Number(rule.amount || 0),
                date: d,
                category: rule.category || (rule.type === 'expense' ? 'General' : 'Income'),
                note: rule.note || 'Recurring',
              };
              if (t.amount <= 0 || !t.accountId) continue;

              const key = txKey(t);
              if (!existing.has(key)) {
                existing.add(key);
                newTxns.push(t);
              }
            }
          }

          let next = state;
          if (newTxns.length) {
            const merged = [...(state.transactions || []), ...newTxns];
            next = reducer(next, { type: 'SET_TRANSACTIONS', payload: merged });
            dispatch({ type: 'SET_TRANSACTIONS', payload: merged });
          }
          next = reducer(next, { type: 'SET_LAST_RECURRING_RUN', payload: today });
          dispatch({ type: 'SET_LAST_RECURRING_RUN', payload: today });
          await persist(next);
        } catch (e) {
          console.warn('[recurring] generation failed', e);
        }
      },

      // Simple “sign out”: clear stored PIN so Splash/Login asks again
      signOut: async () => {
        try {
          await SecureStore.deleteItemAsync(PIN_KEY);
        } catch {}
      },
    }),
    [state]
  );

  // Selectors
  const selectors = useMemo(() => {
    const accountBalance = (accountId) => {
      const id = asId(accountId);
      let bal = 0;
      for (const t of state.transactions || []) {
        if (asId(t.accountId) !== id) continue;
        const v = Number(t.amount || 0);
        bal += t.type === 'expense' ? -v : v;
      }
      return bal;
    };
    return { accountBalance };
  }, [state.transactions]);

  // PIN helpers
  const getPin = async () => {
    try {
      const v = await SecureStore.getItemAsync(PIN_KEY);
      return v || null;
    } catch {
      return null;
    }
  };
  const setPin = async (pin) => {
    try {
      await SecureStore.setItemAsync(PIN_KEY, String(pin));
    } catch {}
  };

  const ctx = useMemo(
    () => ({
      state,
      actions,
      selectors,
      isHydrated: state.isHydrated,
      getPin,
      setPin,
    }),
    [state, actions, selectors]
  );

  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}
