// src/state/AppProvider.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

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
  date: string; // 'YYYY-MM-DD' or ISO string
  note?: string;
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
};

export type AppActions = {
  // Create a new account with a name, returns the created account
  addAccount: (name: string) => Account;

  // Replace full accounts array (kept for compatibility)
  setAccounts: (accounts: Account[]) => void;

  // Update an existing account (e.g. rename)
  updateAccount: (id: string, patch: Partial<Account>) => void;

  // Add a new transaction, id is auto-generated
  addTransaction: (tx: Omit<Transaction, 'id'>) => Transaction;

  // Replace full transactions array (kept for compatibility)
  setTransactions: (txs: Transaction[]) => void;

  // Delete full transactions array (kept for compatibility)
  deleteTransaction: (txId: string) => void;
  updateTransaction: (txId: string, patch: Partial<Transaction>) => void;

  // Delete an account + all its transactions
  deleteAccount: (accountId: string) => void;
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
  });

  // --- Accounts ---

  const addAccount = useCallback((name: string): Account => {
    const trimmed = name.trim();
    const account: Account = {
      id: `acc_${Date.now()}`,
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
        id: `tx_${Date.now()}`,
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
