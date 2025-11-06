// src/state/AppProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

// --- Types ---

export type Account = {
  id: string;
  name: string;
  createdAt?: string; // optional, some screens sort on this
};

export type Transaction = {
  id: string;
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  date?: string;       // make optional so older calls without date still compile
  note?: string;
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
};

export type AppSelectors = {
  accountBalance: (accountId: string) => number;
  accountTransactions: (accountId: string) => Transaction[];
  // alias for older code
  transactionsForAccount: (accountId: string) => Transaction[];
};

type AppActions = {
  addAccount: (name: string) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  resetAll: () => void;
};

export type AppContextValue = {
  state: AppState;
  actions: AppActions;
  selectors: AppSelectors;
  getPin: () => Promise<string | null>;
  setPin: (pin: string) => Promise<void>;
};

// --- Context setup ---

const AppContext = createContext<AppContextValue | undefined>(undefined);

const PIN_KEY = 'debitlens_pin_v1';

type Props = { children: React.ReactNode };

export const AppProvider: React.FC<Props> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    accounts: [],
    transactions: [],
  });

  // Seed with one default account if none
  useEffect(() => {
    setState((prev) => {
      if (prev.accounts.length > 0) return prev;
      const nowIso = new Date().toISOString();
      return {
        ...prev,
        accounts: [
          {
            id: 'acc_main',
            name: 'Main account',
            createdAt: nowIso,
          },
        ],
      };
    });
  }, []);

  // --- selectors depend on current state ---
const selectors: AppSelectors = {
  accountBalance: (accountId: string) => {
    const txs = state.transactions.filter(
      (t) => t.accountId === accountId
    );
    return txs.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount;
      return sum - t.amount;
    }, 0);
  },
  accountTransactions: (accountId: string) => {
    return state.transactions.filter(
      (t) => t.accountId === accountId
    );
  },
  // simple alias so existing code still works
  transactionsForAccount: (accountId: string) => {
    return state.transactions.filter(
      (t) => t.accountId === accountId
    );
  },
};

  // --- actions that mutate state ---
  const actions: AppActions = {
    addAccount: (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        accounts: [
          ...prev.accounts,
          { id: 'acc_' + Date.now(), name: trimmed, createdAt: nowIso },
        ],
      }));
    },
    deleteAccount: (id: string) => {
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== id),
        // also drop its transactions
        transactions: prev.transactions.filter(
          (t) => t.accountId !== id
        ),
      }));
    },
    addTransaction: (tx: Omit<Transaction, 'id'>) => {
      setState((prev) => ({
        ...prev,
        transactions: [
          ...prev.transactions,
          { ...tx, id: 'tx_' + Date.now() },
        ],
      }));
    },
    deleteTransaction: (id: string) => {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.filter(
          (t) => t.id !== id
        ),
      }));
    },
    resetAll: () => {
      setState({
        accounts: [],
        transactions: [],
      });
    },
  };

  const getPin = async (): Promise<string | null> => {
    try {
      const v = await SecureStore.getItemAsync(PIN_KEY);
      return v ?? null;
    } catch {
      return null;
    }
  };

  const setPin = async (pin: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(PIN_KEY, pin);
    } catch (e) {
      console.warn('[AppProvider] setPin failed', e);
      throw e;
    }
  };

  const value: AppContextValue = {
    state,
    actions,
    selectors,
    getPin,
    setPin,
  };

  return (
    <AppContext.Provider value={value}>{children}</AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}

export default AppProvider;
