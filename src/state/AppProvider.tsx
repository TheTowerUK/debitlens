// src/state/AppProvider.tsx
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEY_AUTH = 'auth:loggedIn';
const KEY_PIN = 'auth:pin';
const KEY_ACCOUNTS = 'data:accounts';

export type Account = {
  id: string;
  name: string;
  createdAt: string;
};

type AppState = {
  accounts: Account[];
};

type AppActions = {
  addAccount: (name: string) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;
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

  // Legacy / optional fields for older screens
  selectors?: any;
  payments?: any[];
  addPayment?: (...args: any[]) => any;
};

export const AppContext = React.createContext<AppContextValue | undefined>(undefined);

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

  const [appState, setAppState] = React.useState<AppState>({ accounts: [] });

  // Hydrate auth + accounts on startup
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [authFlag, accountsJson] = await Promise.all([
          AsyncStorage.getItem(KEY_AUTH),
          AsyncStorage.getItem(KEY_ACCOUNTS),
        ]);

        if (!mounted) return;

        setIsAuthenticated(authFlag === '1');

        if (accountsJson) {
          try {
            const parsed = JSON.parse(accountsJson);
            if (parsed && Array.isArray(parsed)) {
              setAppState({ accounts: parsed });
            }
          } catch {
            // ignore bad JSON
          }
        }
      } finally {
        if (mounted) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Persist accounts whenever they change
  React.useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(appState.accounts));
      } catch (e) {
        console.warn('[AppProvider] failed to persist accounts', e);
      }
    })();
  }, [appState.accounts]);

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
    }));
  }, []);

  const actions = React.useMemo<AppActions>(
    () => ({
      addAccount,
      deleteAccount,
      signOut: async () => {
        await AsyncStorage.removeItem(KEY_AUTH);
        setIsAuthenticated(false);
      },
    }),
    [addAccount, deleteAccount]
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
      selectors: {},   // stub for now
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
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
