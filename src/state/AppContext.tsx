// src/state/AppContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* =====================
   Types
===================== */

export type Account = {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'other';
  balance: number; // opening balance
  archived?: boolean;

  /** Credit limit or overdraft limit; balance may go down to -limit. */
  limit?: number;

  color?: string; // e.g. '#3b82f6'
  icon?: string;  // e.g. '🏦'
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type Transaction = {
  id: string;
  date: string; // ISO: YYYY-MM-DD
  accountId: string;
  amount: number;
  type: TransactionType;
  category?: string;
  description?: string;
  name?: string;
  merchant?: string;
  // Transfer-only (when type === 'transfer'):
  fromAccountId?: string;   // source account
  toAccountId?: string;    // destination account
};


/* ===== Recurring (match existing screens) ===== */

export type RecurringFrequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export type RecurringItem = {
  id: string;

  // Your screens use title (not name)
  title: string;

  // Some screens expect active
  active: boolean;

  // Your screens use nextDueDate (not nextDate)
  nextDueDate: string; // YYYY-MM-DD

  // Frequency
  frequency: RecurringFrequency;

  // Amount/type
  amount: number;
  type: 'income' | 'expense';

  // Optional details
  category?: string;
  description?: string;

  // Non-transfer recurring uses accountId
  accountId?: string;

  // Transfer (when applicable):
  fromAccountId?: string;
  toAccountId?: string;
};

/* ===== Budgets ===== */

export type Budget = {
  id: string;
  category: string; // should match Transaction.category
  limit: number; // monthly
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  budgets: Budget[];
};

export type MergeBackupResult = {
  accountsAdded: number;
  accountsUpdated: number;
  transactionsAdded: number;
  transactionsUpdated: number;
  recurringAdded: number;
  recurringUpdated: number;
};

export type AppActions = {
  /* Accounts */
  addAccount: (input: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  /* Transactions */
  addTransaction: (input: Omit<Transaction, 'id'>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  /* Recurring */
  addRecurring: (input: Omit<RecurringItem, 'id'>) => RecurringItem;
  updateRecurring: (id: string, patch: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;

  /* Budgets */
  addBudget: (input: Omit<Budget, 'id'>) => Budget;
  updateBudget: (id: string, patch: Partial<Omit<Budget, 'id'>>) => void;
  deleteBudget: (id: string) => void;

  /* Full restore (Replace) */
  replaceAllData: (next: {
    accounts: Account[];
    transactions: Transaction[];
    recurring?: RecurringItem[];
    budgets?: Budget[];
  }) => void;

  /* Merge restore (Merge) */
  mergeBackup: (input: {
    accounts: Account[];
    transactions: Transaction[];
    recurring?: RecurringItem[];
    budgets?: Budget[];
  }) => MergeBackupResult;

  /* Dangerous */
  resetApp: () => Promise<void>;
};

type AppContextValue = {
  state: AppState;
  actions: AppActions;

  // ✅ SplashAuthScreen expects these at top-level
  getPin: () => string | null;
  setPin: (pin: string | null) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const STORAGE_KEY_APP_STATE = '@debitlens/appState:v1';
const STORAGE_KEY_PIN = '@debitlens/pin:v1';
const PERSIST_DEBOUNCE_MS = 400;

/* =====================
   Helpers
===================== */

function uuid() {
  // crypto.randomUUID isn't always available in RN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isArray<T = any>(v: any): v is T[] {
  return Array.isArray(v);
}

/**
 * Safely parses a YYYY-MM-DD date string as a local date (avoids timezone shifts).
 */
function parseYMDLocal(ymd: string): Date | null {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  dt.setHours(0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Formats a Date to YYYY-MM-DD string.
 */
function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Advances a date by the given frequency.
 */
function advanceDateByFrequency(date: Date, frequency: RecurringFrequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'fortnightly':
      d.setDate(d.getDate() + 14);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

/* =====================
   Provider
===================== */

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [pin, setPinState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const saveStateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actions: AppActions = {
    /* Accounts */
    addAccount: (input) => {
      const account: Account = { ...input, id: uuid() };
      setAccounts((prev) => [...prev, account]);
      return account;
    },
    updateAccount: (id, patch) => {
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
      );
    },
    deleteAccount: (id) => {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setTransactions((prev) =>
        prev.filter(
          (t) =>
            t.accountId !== id && t.fromAccountId !== id && t.toAccountId !== id
        )
      );
      setRecurring((prev) =>
        prev.filter(
          (r) =>
            r.accountId !== id && r.fromAccountId !== id && r.toAccountId !== id
        )
      );
    },

    /* Transactions */
    addTransaction: (input) => {
      const txn: Transaction = { ...input, id: uuid() };
      setTransactions((prev) => [...prev, txn]);

      // Auto-advance recurring items when transaction matches
      setRecurring((prevRecurring) => {
        // Only consider income/expense transactions (ignore transfer)
        if (txn.type === 'transfer') {
          return prevRecurring;
        }

        const txnDate = parseYMDLocal(txn.date);
        if (!txnDate) {
          return prevRecurring;
        }

        const txnAmount = Math.abs(Number(txn.amount) || 0);
        if (txnAmount === 0) {
          return prevRecurring;
        }

        // Find matching recurring items
        const candidates: Array<{
          item: RecurringItem;
          amountDiff: number;
          dateDiff: number;
        }> = [];

        for (const item of prevRecurring) {
          // Only consider active items
          if (item.active === false) continue;

          // Only consider income/expense (ignore transfer)
          if (item.type !== 'income' && item.type !== 'expense') continue;

          // Type must match
          if (item.type !== txn.type) continue;

          // AccountId must match if present on recurring item
          if (item.accountId && item.accountId !== txn.accountId) continue;

          // Amount must match within tolerance
          const itemAmount = Math.abs(Number(item.amount) || 0);
          if (itemAmount === 0) continue;

          const amountDiff = Math.abs(txnAmount - itemAmount);
          const tolerance = Math.max(0.75, itemAmount * 0.03);
          if (amountDiff > tolerance) continue;

          // Date must be within ±3 days window
          const itemDueDate = parseYMDLocal(item.nextDueDate);
          if (!itemDueDate) continue;

          const dateDiffMs = Math.abs(txnDate.getTime() - itemDueDate.getTime());
          const dateDiffDays = dateDiffMs / (1000 * 60 * 60 * 24);
          if (dateDiffDays > 3) continue;

          candidates.push({
            item,
            amountDiff,
            dateDiff: dateDiffDays,
          });
        }

        // If no matches, return unchanged
        if (candidates.length === 0) {
          return prevRecurring;
        }

        // Choose best match: smallest amount difference, then smallest date difference
        candidates.sort((a, b) => {
          if (a.amountDiff !== b.amountDiff) {
            return a.amountDiff - b.amountDiff;
          }
          return a.dateDiff - b.dateDiff;
        });

        const bestMatch = candidates[0].item;
        const frequency = bestMatch.frequency || 'monthly';

        // Advance nextDueDate forward by frequency until it's after the transaction date
        let nextDue = parseYMDLocal(bestMatch.nextDueDate);
        if (!nextDue) {
          return prevRecurring;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Advance until it's after the transaction date (or at least >= today)
        while (nextDue <= txnDate || nextDue < today) {
          nextDue = advanceDateByFrequency(nextDue, frequency);
        }

        const newNextDueDate = formatYMD(nextDue);

        // Update the recurring item
        return prevRecurring.map((r) =>
          r.id === bestMatch.id ? { ...r, nextDueDate: newNextDueDate } : r
        );
      });

      return txn;
    },
    updateTransaction: (id, patch) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
    },
    deleteTransaction: (id) => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },

    /* Recurring */
    addRecurring: (input) => {
      const item: RecurringItem = { ...input, id: uuid() };
      setRecurring((prev) => [...prev, item]);
      return item;
    },
    updateRecurring: (id, patch) => {
      setRecurring((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    deleteRecurring: (id) => {
      setRecurring((prev) => prev.filter((r) => r.id !== id));
    },

    /* Budgets */
    addBudget: (input) => {
      const budget: Budget = { ...input, id: uuid() };
      setBudgets((prev) => [...prev, budget]);
      return budget;
    },
    updateBudget: (id, patch) => {
      setBudgets((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
      );
    },
    deleteBudget: (id) => {
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    },

    /* Full restore (Replace) */
    replaceAllData: (next) => {
      setAccounts(next.accounts || []);
      setTransactions(next.transactions || []);
      setRecurring(next.recurring || []);
      setBudgets(next.budgets || []);
    },

    /* Merge restore (Merge) */
    mergeBackup: (input) => {
      const incomingAccounts = isArray<Account>(input.accounts) ? input.accounts : [];
      const incomingTxs = isArray<Transaction>(input.transactions) ? input.transactions : [];
      const incomingRecurring = isArray<RecurringItem>(input.recurring) ? input.recurring : [];

      let accountsAdded = 0;
      let accountsUpdated = 0;
      let transactionsAdded = 0;
      let transactionsUpdated = 0;
      let recurringAdded = 0;
      let recurringUpdated = 0;

      setAccounts((prev) => {
        const map = new Map(prev.map((a) => [a.id, a] as const));

        for (const a of incomingAccounts) {
          if (!a?.id) continue;
          const existing = map.get(a.id);
          if (!existing) {
            map.set(a.id, a);
            accountsAdded++;
          } else {
            map.set(a.id, { ...existing, ...a });
            accountsUpdated++;
          }
        }

        return Array.from(map.values());
      });

      setTransactions((prev) => {
        const map = new Map(prev.map((t) => [t.id, t] as const));

        for (const t of incomingTxs) {
          if (!t?.id) continue;
          const existing = map.get(t.id);
          if (!existing) {
            map.set(t.id, t);
            transactionsAdded++;
          } else {
            map.set(t.id, { ...existing, ...t });
            transactionsUpdated++;
          }
        }

        return Array.from(map.values());
      });

      setRecurring((prev) => {
        const map = new Map(prev.map((r) => [r.id, r] as const));

        for (const r of incomingRecurring) {
          if (!r?.id) continue;
          const existing = map.get(r.id);
          if (!existing) {
            map.set(r.id, r);
            recurringAdded++;
          } else {
            map.set(r.id, { ...existing, ...r });
            recurringUpdated++;
          }
        }

        return Array.from(map.values());
      });

      // Budgets: keep current unless explicitly supplied
      if (isArray<Budget>(input.budgets)) {
        setBudgets(input.budgets);
      }

      return {
        accountsAdded,
        accountsUpdated,
        transactionsAdded,
        transactionsUpdated,
        recurringAdded,
        recurringUpdated,
      };
    },

    /* Dangerous */
    resetApp: async () => {
      // Clear in-memory state
      setAccounts([]);
      setTransactions([]);
      setRecurring([]);
      setBudgets([]);
      setPinState(null);

      // Clear persisted storage
      try {
        await Promise.all([
          AsyncStorage.removeItem(STORAGE_KEY_APP_STATE),
          AsyncStorage.removeItem(STORAGE_KEY_PIN),
        ]);
      } catch {
        // ignore storage errors
      }
    },
  };

  const state = useMemo<AppState>(
    () => ({ accounts, transactions, recurring, budgets }),
    [accounts, transactions, recurring, budgets]
  );

  useEffect(() => {
    async function loadFromStorage() {
      try {
        const [rawState, rawPin] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_APP_STATE),
          AsyncStorage.getItem(STORAGE_KEY_PIN),
        ]);

        if (rawState != null && rawState !== '') {
          try {
            const parsed = JSON.parse(rawState) as Partial<AppState>;
            setAccounts(isArray(parsed?.accounts) ? parsed.accounts : []);
            setTransactions(isArray(parsed?.transactions) ? parsed.transactions : []);
            setRecurring(isArray(parsed?.recurring) ? parsed.recurring : []);
            setBudgets(isArray(parsed?.budgets) ? parsed.budgets : []);
          } catch {
            /* corrupted JSON: ignore, keep defaults */
          }
        }

        if (rawPin != null && rawPin !== '') {
          setPinState(rawPin);
        }
      } catch {
        /* load error: ignore, continue with defaults */
      } finally {
        setHydrated(true);
      }
    }
    void loadFromStorage();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveStateTimeoutRef.current) {
      clearTimeout(saveStateTimeoutRef.current);
      saveStateTimeoutRef.current = null;
    }
    saveStateTimeoutRef.current = setTimeout(() => {
      saveStateTimeoutRef.current = null;
      void AsyncStorage.setItem(STORAGE_KEY_APP_STATE, JSON.stringify(state));
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (saveStateTimeoutRef.current) {
        clearTimeout(saveStateTimeoutRef.current);
        saveStateTimeoutRef.current = null;
      }
    };
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (savePinTimeoutRef.current) {
      clearTimeout(savePinTimeoutRef.current);
      savePinTimeoutRef.current = null;
    }
    savePinTimeoutRef.current = setTimeout(() => {
      savePinTimeoutRef.current = null;
      if (pin == null || pin === '') {
        void AsyncStorage.removeItem(STORAGE_KEY_PIN);
      } else {
        void AsyncStorage.setItem(STORAGE_KEY_PIN, pin);
      }
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (savePinTimeoutRef.current) {
        clearTimeout(savePinTimeoutRef.current);
        savePinTimeoutRef.current = null;
      }
    };
  }, [pin, hydrated]);

  const getPin = () => pin;
  const setPin = (nextPin: string | null) => setPinState(nextPin);

  return (
    <AppContext.Provider value={{ state, actions, getPin, setPin }}>
      {children}
    </AppContext.Provider>
  );
}

/* =====================
   Hook
===================== */

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}