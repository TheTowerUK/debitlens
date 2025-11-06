// src/state/AppProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

// ---------- Types ----------

export type Account = {
  id: string;
  name: string;
  createdAt?: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  date?: string;
  note?: string;
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
};

export type AppSelectors = {
  accountBalance: (accountId: string) => number;
  accountTransactions: (accountId: string) => Transaction[];
  transactionsForAccount: (accountId: string) => Transaction[]; // alias
};

export type AppActions = {
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

// ---------- Context ----------

const AppContext = createContext<AppContextValue | undefined>(undefined);
const PIN_KEY = 'debitlens_pin_v1';

type Props = { children: React.ReactNode };

export const AppProvider: React.FC<Props> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    accounts: [],
    transactions: [],
  });

  // Seed a default account if none exist
  useEffect(() => {
    setState(prev => {
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

  // ---------- selectors ----------

  const selectors: AppSelectors = {
    accountBalance: (accountId: string) => {
      const txs = state.transactions.filter(t => t.accountId === accountId);
      return txs.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount;
        return sum - t.amount;
      }, 0);
    },
    accountTransactions: (accountId: string) => {
      return state.transactions.filter(t => t.accountId === accountId);
    },
    transactionsForAccount: (accountId: string) => {
      // alias for older code
      return state.transactions.filter(t => t.accountId === accountId);
    },
  };

  // ---------- actions ----------

  const actions: AppActions = {
    addAccount: (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const nowIso = new Date().toISOString();
      setState(prev => ({
        ...prev,
        accounts: [
          ...prev.accounts,
          {
            id: 'acc_' + Date.now(),
            name: trimmed,
            createdAt: nowIso,
          },
        ],
      }));
    },

    deleteAccount: (id: string) => {
      setState(prev => ({
        ...prev,
        accounts: prev.accounts.filter(a => a.id !== id),
        transactions: prev.transactions.filter(t => t.accountId !== id),
      }));
    },

    addTransaction: (tx: Omit<Transaction, 'id'>) => {
      setState(prev => ({
        ...prev,
        transactions: [
          ...prev.transactions,
          { ...tx, id: 'tx_' + Date.now() },
        ],
      }));
    },

    deleteTransaction: (id: string) => {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id),
      }));
    },

    resetAll: () => {
      setState({
        accounts: [],
        transactions: [],
      });
    },
  };

  // ---------- PIN helpers (SecureStore) ----------

  const getPin = async (): Promise<string | null> => {
    try {
      const v = await SecureStore.getItemAsync(PIN_KEY);
      console.log('[PIN] getPin ->', v);
      return v ?? null;
    } catch (e) {
      console.warn('[PIN] getPin failed', e);
      return null;
    }
  };

  const setPin = async (pin: string): Promise<void> => {
    try {
      console.log('[PIN] setPin ->', pin);
      await SecureStore.setItemAsync(PIN_KEY, pin);
    } catch (e) {
      console.warn('[PIN] setPin failed', e);
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
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

// Hook
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}

export default AppProvider;
