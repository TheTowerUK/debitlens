// src/state/AppContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from 'react';

export interface Account {
  id: string;
  name?: string;
  label?: string;
  // extend with any other fields you use
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  accountId: string;
  date: string; // ISO date string
  type: TransactionType;
  amount: number;
  description?: string;
  category?: string;
}

export interface RecurringItem {
  id: string;
  accountId: string;
  schedule: string; // e.g. 'monthly', cron-like, etc.
  amount: number;
  type: TransactionType;
  description?: string;
  category?: string;
  // add more fields as needed
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  // add more slices later if needed (budgets, reports, settings, etc.)
}

export interface AppActions {
  addAccount: (account: Partial<Account>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (tx: Partial<Transaction>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addRecurring: (item: Partial<RecurringItem>) => void;
  updateRecurring: (id: string, updates: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;
}

export interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const initialState: AppState = {
  accounts: [],
  transactions: [],
  recurring: [],
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  const actions = useMemo<AppActions>(
    () => ({
      // -------- ACCOUNTS --------
      addAccount(account) {
        setState((prev) => {
          const id = account.id ?? generateId('acct');
          return {
            ...prev,
            accounts: [...prev.accounts, { ...account, id } as Account],
          };
        });
      },

      updateAccount(id, updates) {
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },

      deleteAccount(id) {
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.filter((a) => a.id !== id),
          transactions: prev.transactions.filter((t) => t.accountId !== id),
          recurring: prev.recurring.filter((r) => r.accountId !== id),
        }));
      },

      // -------- TRANSACTIONS --------
      addTransaction(tx) {
        setState((prev) => {
          const id = tx.id ?? generateId('tx');
          const accountId =
            tx.accountId ??
            prev.accounts[0]?.id ??
            generateId('missingAccount');

          const amount = typeof tx.amount === 'number'
            ? tx.amount
            : Number(tx.amount ?? 0);

          const item: Transaction = {
            id,
            accountId,
            date: tx.date ?? new Date().toISOString().slice(0, 10),
            type: tx.type === 'income' ? 'income' : 'expense',
            amount,
            description: tx.description ?? '',
            category: tx.category ?? '',
          };

          return {
            ...prev,
            transactions: [...prev.transactions, item],
          };
        });
      },

      updateTransaction(id, updates) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        }));
      },

      deleteTransaction(id) {
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== id),
        }));
      },

      // -------- RECURRING --------
      addRecurring(item) {
        setState((prev) => {
          const id = item.id ?? generateId('rec');
          const accountId =
            item.accountId ??
            prev.accounts[0]?.id ??
            generateId('missingAccount');

          const amount = typeof item.amount === 'number'
            ? item.amount
            : Number(item.amount ?? 0);

          const rec: RecurringItem = {
            id,
            accountId,
            schedule: item.schedule ?? 'monthly',
            type: item.type === 'income' ? 'income' : 'expense',
            amount,
            description: item.description ?? '',
            category: item.category ?? '',
          };

          return {
            ...prev,
            recurring: [...prev.recurring, rec],
          };
        });
      },

      updateRecurring(id, updates) {
        setState((prev) => ({
          ...prev,
          recurring: prev.recurring.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      deleteRecurring(id) {
        setState((prev) => ({
          ...prev,
          recurring: prev.recurring.filter((r) => r.id !== id),
        }));
      },
    }),
    []
  );

  const value = useMemo<AppContextValue>(
    () => ({ state, actions }),
    [state, actions]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
