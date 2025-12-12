// src/state/AppContext.tsx
import React from 'react';

// ====== TYPES ======

export type Account = {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'other';
  balance: number;
  archived?: boolean;
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type Transaction = {
  id: string;
  name: string;             // label/title for the transaction
  accountId: string;
  date: string;             // ISO string: 'YYYY-MM-DD'
  type: TransactionType;
  category?: string;
  amount: number;
  description?: string;
};

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringItem = {
  id: string;
  title: string;
  amount: number;
  frequency: RecurringFrequency;

  // Single-account recurring
  accountId?: string;
  type?: 'income' | 'expense';

  // Status / scheduling
  active?: boolean;
  nextDueDate?: string; // ISO datetime string

  // Transfers
  isTransfer?: boolean;
  fromAccountId?: string;
  toAccountId?: string;
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  // You can extend this later (e.g. prefs, settings, etc.)
};

export type AppActions = {
  // Accounts
  addAccount: (input: Partial<Account>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Recurring
  addRecurring: (item: RecurringItem) => void;
  updateRecurring: (id: string, patch: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;

  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Utilities
  clearAllData: () => void;

  // Full backup restore
  loadBackup: (backupState: Partial<AppState>) => void;
};

// ====== INITIAL STATE ======

const INITIAL_STATE: AppState = {
  accounts: [
    {
      id: 'acc-1',
      name: 'Main account',
      type: 'bank',
      balance: 0,
    },
  ],
  transactions: [],
  recurring: [],
};

// ====== CONTEXT SETUP ======

type AppContextValue = {
  state: AppState;
  actions: AppActions;
  // PIN helpers for SplashAuthScreen
  getPin: () => Promise<string | null>;
  setPin: (pin: string) => Promise<void>;
};

const AppContext = React.createContext<AppContextValue | undefined>(
  undefined
);

// ====== PROVIDER ======

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(INITIAL_STATE);

  // Simple in-memory PIN (non-persisted for now)
  const [pin, setPinState] = React.useState<string | null>(null);

  const getPin = React.useCallback(async () => {
    return pin;
  }, [pin]);

  const setPin = React.useCallback(async (newPin: string) => {
    setPinState(newPin);
  }, []);

  // --- Account actions ---

  const addAccount = React.useCallback(
    (input: Partial<Account>): Account => {
      const id = `acc-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;

      const next: Account = {
        id,
        name: input.name ?? 'New account',
        type: input.type ?? 'bank',
        balance: input.balance ?? 0,
        archived: input.archived ?? false,
      };

      setState((prev) => ({
        ...prev,
        accounts: [...prev.accounts, next],
      }));

      return next;
    },
    []
  );

  const updateAccount = React.useCallback(
    (id: string, patch: Partial<Account>) => {
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === id ? { ...a, ...patch } : a
        ),
      }));
    },
    []
  );

  const deleteAccount = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
      transactions: prev.transactions.filter((t) => t.accountId !== id),
      // you could also remove related recurring items here if desired
    }));
  }, []);

  // --- Recurring actions (stored inside state.recurring) ---

  const addRecurring = React.useCallback((item: RecurringItem) => {
    setState((prev) => ({
      ...prev,
      recurring: [...prev.recurring, item],
    }));
  }, []);

  const updateRecurring = React.useCallback(
    (id: string, patch: Partial<RecurringItem>) => {
      setState((prev) => ({
        ...prev,
        recurring: prev.recurring.map((r) =>
          r.id === id ? { ...r, ...patch } : r
        ),
      }));
    },
    []
  );

  const deleteRecurring = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      recurring: prev.recurring.filter((r) => r.id !== id),
    }));
  }, []);

  // --- Transaction actions ---

  const addTransaction = React.useCallback(
    (tx: Omit<Transaction, 'id'>) => {
      const id = `tx-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const next: Transaction = { id, ...tx };

      setState((prev) => ({
        ...prev,
        transactions: [...prev.transactions, next],
      }));
    },
    []
  );

  const updateTransaction = React.useCallback(
    (id: string, patch: Partial<Transaction>) => {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      }));
    },
    []
  );

  const deleteTransaction = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  // --- Utilities ---

  const clearAllData = React.useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // --- Full backup restore ---

  const loadBackup = React.useCallback(
    (backupState: Partial<AppState>) => {
      if (!backupState || typeof backupState !== 'object') {
        console.warn(
          'loadBackup: backupState is not an object',
          backupState
        );
        return;
      }

      setState((prev) => {
        const merged: AppState = {
          ...prev, // or ...INITIAL_STATE if you want a hard reset
          ...backupState,
        };

        if (!Array.isArray(merged.accounts)) merged.accounts = [];
        if (!Array.isArray(merged.transactions))
          merged.transactions = [];
        if (!Array.isArray(merged.recurring)) merged.recurring = [];

        return merged;
      });
    },
    []
  );

  const actions: AppActions = {
    addAccount,
    updateAccount,
    deleteAccount,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    clearAllData,
    loadBackup,
  };

  const value: AppContextValue = {
    state,
    actions,
    getPin,
    setPin,
  };

  return (
    <AppContext.Provider value={value}>{children}</AppContext.Provider>
  );
}

// ====== HOOK ======

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
