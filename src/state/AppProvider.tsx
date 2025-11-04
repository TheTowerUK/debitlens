// src/state/AppProvider.tsx
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEY_AUTH = 'auth:loggedIn';
const KEY_PIN = 'auth:pin';
const KEY_ACCOUNTS = 'data:accounts';
const KEY_TRANSACTIONS = 'data:transactions';

export type Account = {
  id: string;
  name: string;
  createdAt: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  amount: number;           // positive number
  type: 'income' | 'expense';
  note?: string;
  date: string;             // ISO timestamp
};

type AppState = {
  accounts: Account[];
  transactions: Transaction[];
};

type AppSelectors = {
  accountBalance: (accountId: string) => number;
  transactionsForAccount: (accountId: string) => Transaction[];
};

type AppActions = {
  addAccount: (name: string) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;
  addTransaction: (input: {
    accountId: string;
    amount: number;
    type: 'income' | 'expense';
    note?: string;
  }) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type AppContextValue = {
  // Auth / PIN
  isHydrated: boolean;
  isAuthenticated: boolean;
  getPin: () => Promise<string | null>;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;

  // App data
  state: AppState;
  actions: AppActions;
  selectors: AppSelectors;

  // Legacy fields (kept just so old code doesn’t explode)
  payments?: any[];
  addPayment?: (...args: any[]) => any;
};

export const AppContext = React.createContext<AppContextValue | undefined>(
  undefined
);

export function useApp(): AppContextValue {
  const ctx = React.useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within <AppProvider>');
  }
  return ctx;
}

// Helpers: try SecureStore first, fall back to AsyncStorage
async function secureGetItem(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch {
    // ignore
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function secureSetItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {
    // ignore and fall back
  }
  await AsyncStorage.setItem(key, value);
}

async function secureDeleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
    return;
  } catch {
    // ignore and fall back
  }
  await AsyncStorage.removeItem(key);
}

type Props = { children: React.ReactNode };

export default function AppProvider({ children }: Props) {
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  const [appState, setAppState] = React.useState<AppState>({
    accounts: [],
    transactions: [],
  });

  // Hydrate auth + accounts + transactions
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [authFlag, accountsJson, txJson] = await Promise.all([
          AsyncStorage.getItem(KEY_AUTH),
          AsyncStorage.getItem(KEY_ACCOUNTS),
          AsyncStorage.getItem(KEY_TRANSACTIONS),
        ]);

        if (!mounted) return;

        setIsAuthenticated(authFlag === '1');

        if (accountsJson) {
          try {
            const parsed = JSON.parse(accountsJson);
            if (Array.isArray(parsed)) {
              appState.accounts = parsed;
            }
          } catch {
            // ignore bad JSON
          }
        }

        if (txJson) {
          try {
            const parsed = JSON.parse(txJson);
            if (Array.isArray(parsed)) {
              appState.transactions = parsed;
            }
          } catch {
            // ignore
          }
        }

        // force state update after mutation
        setAppState({ ...appState });
      } finally {
        if (mounted) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist accounts whenever they change
  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(
          KEY_ACCOUNTS,
          JSON.stringify(appState.accounts)
        );
      } catch (e) {
        console.warn('[AppProvider] failed to persist accounts', e);
      }
    })();
  }, [appState.accounts]);

  // Persist transactions whenever they change
  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(
          KEY_TRANSACTIONS,
          JSON.stringify(appState.transactions)
        );
      } catch (e) {
        console.warn('[AppProvider] failed to persist transactions', e);
      }
    })();
  }, [appState.transactions]);

  const getPin = React.useCallback(() => {
    return secureGetItem(KEY_PIN);
  }, []);

  const setPin = React.useCallback(async (pin: string) => {
    await secureSetItem(KEY_PIN, pin);
  }, []);

  const clearPin = React.useCallback(async () => {
    await secureDeleteItem(KEY_PIN);
  }, []);

  const login = React.useCallback(async () => {
    await AsyncStorage.setItem(KEY_AUTH, '1');
    setIsAuthenticated(true);
  }, []);

  const logout = React.useCallback(async () => {
    await AsyncStorage.removeItem(KEY_AUTH);
    setIsAuthenticated(false);
  }, []);

  // Actions for accounts
  const addAccount = React.useCallback(async (name: string): Promise<Account> => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Account name is required');
    }
    const now = new Date().toISOString();
    const account: Account = {
      id: `acc_${Date.now()}`,
      name: trimmed,
      createdAt: now,
    };
    setAppState(prev => ({ ...prev, accounts: [...prev.accounts, account] }));
    return account;
  }, []);

  const deleteAccount = React.useCallback(async (id: string): Promise<void> => {
    setAppState(prev => ({
      ...prev,
      accounts: prev.accounts.filter(a => a.id !== id),
      transactions: prev.transactions.filter(t => t.accountId !== id),
    }));
  }, []);

  // Actions for transactions
  const addTransaction = React.useCallback(
    async (input: {
      accountId: string;
      amount: number;
      type: 'income' | 'expense';
      note?: string;
    }): Promise<Transaction> => {
      const { accountId, amount, type, note } = input;
      if (!accountId) throw new Error('accountId is required');
      if (!amount || !Number.isFinite(amount)) {
        throw new Error('Amount must be a number');
      }
      const tx: Transaction = {
        id: `tx_${Date.now()}`,
        accountId,
        amount: Math.abs(amount),
        type,
        note,
        date: new Date().toISOString(),
      };
      setAppState(prev => ({
        ...prev,
        transactions: [...prev.transactions, tx],
      }));
      return tx;
    },
    []
  );

  const deleteTransaction = React.useCallback(async (id: string): Promise<void> => {
    setAppState(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== id),
    }));
  }, []);

  // Selectors
  const selectors: AppSelectors = React.useMemo(
    () => ({
      accountBalance: (accountId: string): number => {
        const txs = appState.transactions.filter(t => t.accountId === accountId);
        return txs.reduce((sum, t) => {
          const signed = t.type === 'income' ? t.amount : -t.amount;
          return sum + signed;
        }, 0);
      },
      transactionsForAccount: (accountId: string): Transaction[] =>
        appState.transactions
          .filter(t => t.accountId === accountId)
          .sort((a, b) => b.date.localeCompare(a.date)),
    }),
    [appState.transactions]
  );

  const actions = React.useMemo<AppActions>(
    () => ({
      addAccount,
      deleteAccount,
      addTransaction,
      deleteTransaction,
      signOut: async () => {
        await AsyncStorage.removeItem(KEY_AUTH);
        setIsAuthenticated(false);
      },
    }),
    [addAccount, deleteAccount, addTransaction, deleteTransaction]
  );

  const value = React.useMemo<AppContextValue>(
    () => ({
      isHydrated,
      isAuthenticated,
      getPin,
      setPin,
      clearPin,
      login,
      logout,
      state: appState,
      actions,
      selectors,
      payments: [],
      addPayment: () => {},
    }),
    [
      isHydrated,
      isAuthenticated,
      getPin,
      setPin,
      clearPin,
      login,
      logout,
      appState,
      actions,
      selectors,
    ]
  );

  return (
    <AppContext.Provider value={value}>{children}</AppContext.Provider>
  );
}
