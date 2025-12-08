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
  accountId: string;
  date: string; // ISO string: 'YYYY-MM-DD'
  type: TransactionType;
  category?: string;
  amount: number;
  description?: string;
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  // 👇 If you know you have more in state elsewhere, you can extend this later
  // e.g. settings?: { currency: string; ... };
};

export type AppActions = {
  // Accounts
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  // Utilities
  clearAllData: () => void;

  // Full backup restore
  loadBackup: (backupState: AppState)=> void;
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
};

// ====== CONTEXT SETUP ======

type AppContextValue = {
  state: AppState;
  actions: AppActions;
};

const AppContext = React.createContext<AppContextValue | undefined>(undefined);

// ====== PROVIDER ======

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState>(INITIAL_STATE);

  // --- Account actions ---

  const addAccount = React.useCallback(
    (account: Omit<Account, 'id'>) => {
      const id = `acc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next: Account = { id, ...account };

      setState((prev) => ({
        ...prev,
        accounts: [...prev.accounts, next],
      }));
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
    }));
  }, []);

  // --- Transaction actions ---

  const addTransaction = React.useCallback(
    (tx: Omit<Transaction, 'id'>) => {
      const id = `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  const loadBackup = React.useCallback((backupState: any) => {
  if (!backupState || typeof backupState !== 'object') {
    console.warn('loadBackup: backupState is not an object', backupState);
    return;
  }

  setState((prev) => {
    // Start from INITIAL_STATE to avoid carrying over old data
    const merged: AppState = {
      ...prev,         // or ...INITIAL_STATE if you prefer a hard reset
      ...backupState,
    };

    if (!Array.isArray(merged.accounts)) merged.accounts = [];
    if (!Array.isArray(merged.transactions)) merged.transactions = [];

    return merged;
  });
}, []);

  const actions: AppActions = {
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    clearAllData,
    loadBackup,
  };

  const value: AppContextValue = { state, actions };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ====== HOOK ======

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
