// src/state/AppContext.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

/** DOMAIN TYPES **/

export interface Account {
  id: string;
  name?: string;
  label?: string;
  // add more fields if you already use them elsewhere
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  accountId: string;
  date: string;           // ISO date string, e.g. "2025-11-26"
  type: TransactionType;
  amount: number;
  description?: string;
  category?: string;
  note?: string;          // 👈 ADD THIS
}


export interface RecurringItem {
  id: string;
  accountId: string;
  schedule: string;       // e.g. "monthly", "weekly"
  type: TransactionType;
  amount: number;
  description?: string;
  category?: string;
}

/** STATE & ACTION TYPES **/

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
}

export interface AppActions {
  // Accounts
  addAccount: (account: Partial<Account>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Transactions
  addTransaction: (tx: Partial<Transaction>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Recurring
  addRecurring: (item: Partial<RecurringItem>) => void;
  updateRecurring: (id: string, updates: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;
}

export interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

/** INITIAL STATE **/

const initialState: AppState = {
  accounts: [],
  transactions: [],
  recurring: [],
};

/** IMPLEMENTATION **/

const AppContext = createContext<AppContextValue | undefined>(undefined);

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);

  const actions = useMemo<AppActions>(
    () => ({
      // ------- ACCOUNTS -------

      addAccount(account) {
        setState((prev) => {
          const id = account.id ?? generateId('acct');
          const newAccount: Account = {
            id,
            name: account.name ?? '',
            label: account.label ?? account.name ?? '',
          };
          return {
            ...prev,
            accounts: [...prev.accounts, newAccount],
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

      // ------- TRANSACTIONS -------

      addTransaction(tx) {
        setState((prev) => {
          const id = tx.id ?? generateId('tx');

          const accountId =
            tx.accountId ??
            prev.accounts[0]?.id ??
            generateId('missingAccount');

          const amount =
            typeof tx.amount === 'number'
              ? tx.amount
              : Number(tx.amount ?? 0);

            const newTx: Transaction = {
            id,
            accountId,
            date: tx.date ?? new Date().toISOString().slice(0, 10),
            type: tx.type === 'income' ? 'income' : 'expense',
            amount,
            description: tx.description ?? '',
            category: tx.category ?? '',
            note: tx.note ?? '',     // 👈 ADD THIS
            };


          return {
            ...prev,
            transactions: [...prev.transactions, newTx],
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

      // ------- RECURRING -------

      addRecurring(item) {
        setState((prev) => {
          const id = item.id ?? generateId('rec');
          const accountId =
            item.accountId ??
            prev.accounts[0]?.id ??
            generateId('missingAccount');

          const amount =
            typeof item.amount === 'number'
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

  const value: AppContextValue = useMemo(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
