// src/state/AppProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

// ---------- Types ----------

export type Account = {
  id: string;
  name: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  note?: string | null;
  category?: string | null;
};

export interface Budget {
  id: string;
  title: string;
  amount: number;
  // Optional category this budget is tied to; if null/empty, treated as "All expenses"
  category?: string | null;
  // For now we only support monthly budgets, but the field lets us extend later.
  period?: 'monthly';
}

export interface AppState {
  accounts: any[];       // keep your existing types if you already have them
  transactions: any[];
  budgets: Budget[];
  categories: any[];
  recurring: RecurringItem[]; // <-- ADD THIS
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringItem {
  id: string;
  title: string;
  amount: number;
  frequency: RecurringFrequency;

  // Single-account recurring (existing behaviour)
  accountId?: string;
  type?: 'income' | 'expense';

  // Transfer-specific
  isTransfer?: boolean;
  fromAccountId?: string;
  toAccountId?: string;

  // Scheduling
  nextDueDate?: string; // ISO string

  // Status
  active?: boolean;
}

export interface AppState {
  accounts: any[];
  transactions: any[];
  budgets: Budget[];
  categories: any[];
  recurring: RecurringItem[];
}


export type AppActions = {
  // Accounts
  addAccount: (name: string) => Account;
  setAccounts: (accounts: Account[]) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (accountId: string) => void;

  // Transactions
  addTransaction: (tx: Omit<Transaction, 'id'>) => Transaction;
  setTransactions: (txs: Transaction[]) => void;
  deleteTransaction: (txId: string) => void;
  updateTransaction: (txId: string, patch: Partial<Transaction>) => void;

  // Recurring
  addRecurring: (item: RecurringItem) => void;
  updateRecurring: (id: string, updates: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;

  // --- Budgets ---
  addBudget: (b: Omit<Budget, 'id'>) => Budget;
  updateBudget: (id: string, patch: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;

  // --- Import / Export ---
  importData: (payload: Partial<AppState>) => void;
};

export type AppContextValue = {
  state: AppState;
  actions: AppActions;
  getPin: () => Promise<string | null>;
  setPin: (pin: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const PIN_KEY = 'debitlens_pin_v1';

// ---------- Provider ----------

type Props = {
  children: React.ReactNode;
};

export function AppProvider({ children }: Props) {
  const [state, setState] = useState<AppState>({
    accounts: [],
    transactions: [],
    budgets: [],
    categories: [],
    recurring: [], // 🔹 INITIALISE HERE
  });

  // --- Accounts ---

  const addAccount = useCallback((name: string): Account => {
    const trimmed = name.trim();
    const account: Account = {
      id: makeId('acc_'),         // <- was `acc_${Date.now()}`
      name: trimmed || 'Account',
    };
    setState(prev => ({
      ...prev,
      accounts: [...prev.accounts, account],
    }));
    return account;
  }, []);

  const setAccounts = useCallback((accounts: Account[]) => {
    setState(prev => ({
      ...prev,
      accounts,
    }));
  }, []);

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc =>
        acc.id === id ? { ...acc, ...patch } : acc
      ),
    }));
  }, []);

  const deleteAccount = useCallback((accountId: string) => {
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.filter(a => a.id !== accountId),
      transactions: prev.transactions.filter(t => t.accountId !== accountId),
    }));
  }, []);

  // --- Transactions ---

  const addTransaction = useCallback(
    (tx: Omit<Transaction, 'id'>): Transaction => {
      const full: Transaction = {
        ...tx,
        id: makeId('tx_'),       // <- was `tx_${Date.now()}`
      };
      setState(prev => ({
        ...prev,
        transactions: [...prev.transactions, full],
      }));
      return full;
    },
    []
  );

  const setTransactions = useCallback((txs: Transaction[]) => {
    setState(prev => ({
      ...prev,
      transactions: txs,
    }));
  }, []);

  const deleteTransaction = useCallback((txId: string) => {
    setState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== txId),
    }));
  }, []);

  const updateTransaction = useCallback(
    (txId: string, patch: Partial<Transaction>) => {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.map(t =>
          t.id === txId ? { ...t, ...patch } : t
        ),
      }));
    },
    []
  );

  // --- Recurring ---

  const addRecurring = useCallback((item: RecurringItem) => {
    setState(prev => ({
      ...prev,
      recurring: [...prev.recurring, item],
    }));
  }, []);

  const updateRecurring = useCallback(
    (id: string, updates: Partial<RecurringItem>) => {
      setState(prev => ({
        ...prev,
        recurring: prev.recurring.map(r =>
          r.id === id ? { ...r, ...updates } : r
        ),
      }));
    },
    []
  );

  const deleteRecurring = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      recurring: prev.recurring.filter(r => r.id !== id),
    }));
  }, []);

  // --- Budgets ---

  const addBudget = useCallback((b: Omit<Budget, 'id'>): Budget => {
    const budget: Budget = {
      id: makeId('bud_'),
      period: 'monthly',
      ...b,
    };
    setState(prev => ({
      ...prev,
      budgets: [...prev.budgets, budget],
    }));
    return budget;
  }, []);

  const updateBudget = useCallback((id: string, patch: Partial<Budget>) => {
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.map(b =>
        b.id === id ? { ...b, ...patch } : b
      ),
    }));
  }, []);

  const deleteBudget = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      budgets: prev.budgets.filter(b => b.id !== id),
    }));
  }, []);

  // --- Import data (merge/replace collections) ---

  const importData = useCallback((data: Partial<AppState>) => {
    setState(prev => ({
      ...prev,
      accounts: data.accounts ?? prev.accounts,
      transactions: data.transactions ?? prev.transactions,
      budgets: data.budgets ?? prev.budgets,
      categories: data.categories ?? prev.categories,
      recurring: data.recurring ?? prev.recurring,
    }));
  }, []);

  // --- PIN management ---

  const getPin = useCallback(async () => {
    try {
      const v = await SecureStore.getItemAsync(PIN_KEY);
      return v ?? null;
    } catch {
      return null;
    }
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
  }, []);

  const value: AppContextValue = {
    state,
    actions: {
      addAccount,
      setAccounts,
      updateAccount,
      addTransaction,
      setTransactions,
      deleteTransaction,
      deleteAccount,
      updateTransaction,
      addRecurring,
      updateRecurring,
      deleteRecurring,

      // budgets
      addBudget,
      updateBudget,
      deleteBudget,

      importData,
    },
    getPin,
    setPin,
  };


  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}

export default AppProvider;
