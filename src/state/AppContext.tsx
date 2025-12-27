// src/state/AppContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* =====================
   Types
===================== */

export type Account = {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'other';
  balance: number; // opening balance
  archived?: boolean;
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type Transaction = {
  id: string;
  name?: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category?: string;
  amount: number;
  description?: string;
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

  // Some screens expect transfer flags/fields
  isTransfer?: boolean;
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
};

type AppContextValue = {
  state: AppState;
  actions: AppActions;

  // ✅ SplashAuthScreen expects these at top-level
  getPin: () => string | null;
  setPin: (pin: string | null) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

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

/* =====================
   Provider
===================== */

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [pin, setPinState] = useState<string | null>(null);

  const actions = useMemo<AppActions>(
    () => ({
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
        setTransactions((prev) => prev.filter((t) => t.accountId !== id));
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
    }),
    []
  );

  const state = useMemo<AppState>(
    () => ({ accounts, transactions, recurring, budgets }),
    [accounts, transactions, recurring, budgets]
  );

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
