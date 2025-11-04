// src/state/AppProvider.tsx
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const KEY_AUTH = 'auth:loggedIn';
const KEY_PIN = 'auth:pin';

type AppContextValue = {
  // Auth / PIN
  isHydrated: boolean;
  isAuthenticated: boolean;
  getPin: () => Promise<string | null>;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;

  // Legacy / upcoming fields so existing screens compile
  state?: any;
  selectors?: any;
  actions?: any;
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

  // Placeholder "state/selectors/actions" for older screens
  const legacyState = React.useMemo(() => ({}), []);
  const legacySelectors = React.useMemo(() => ({}), []);
  const legacyActions = React.useMemo(
    () => ({
      // you can flesh these out later as needed
      signOut: async () => {
        await AsyncStorage.removeItem(KEY_AUTH);
        setIsAuthenticated(false);
      },
    }),
    []
  );

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(KEY_AUTH);
        if (mounted) {
          setIsAuthenticated(stored === '1');
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

  const value = React.useMemo<AppContextValue>(
    () => ({
      isHydrated,
      isAuthenticated,
      getPin,
      setPin,
      clearPin,
      login,
      logout,

      // legacy-compatible fields
      state: legacyState,
      selectors: legacySelectors,
      actions: legacyActions,
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
      legacyState,
      legacySelectors,
      legacyActions,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
