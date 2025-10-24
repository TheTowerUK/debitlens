// src/state/AppState.js
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Storage keys
const KEY_AUTH = 'auth:loggedIn';
const KEY_PIN  = 'auth:pin';

// Prefer SecureStore for PIN, fallback to AsyncStorage
async function secureGetItem(key) {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v != null) return v;
  } catch {}
  return AsyncStorage.getItem(key);
}
async function secureSetItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch {}
  await AsyncStorage.setItem(key, value);
}
async function secureDeleteItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
    return;
  } catch {}
  await AsyncStorage.removeItem(key);
}

export const AppContext = React.createContext(undefined);

export function useApp() {
  const ctx = React.useContext(AppContext);
  if (ctx === undefined) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export default function AppProvider({ children }) {
  // minimal global state that SplashAuth needs
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // hydrate once
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [logged, pin] = await Promise.all([
          AsyncStorage.getItem(KEY_AUTH),
          secureGetItem(KEY_PIN),
        ]);
        if (!mounted) return;
        setIsAuthenticated(logged === '1');
        // (we don’t store the PIN in state—only fetch on demand)
      } finally {
        if (mounted) setIsHydrated(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Helpers SplashAuth uses
  const getPin   = React.useCallback(() => secureGetItem(KEY_PIN), []);
  const setPin   = React.useCallback((v) => secureSetItem(KEY_PIN, String(v ?? '')), []);
  const clearPin = React.useCallback(() => secureDeleteItem(KEY_PIN), []);

  // Simple auth helpers (optional, handy for a future Login/Logout)
  const login  = React.useCallback(async () => {
    await AsyncStorage.setItem(KEY_AUTH, '1');
    setIsAuthenticated(true);
  }, []);
  const logout = React.useCallback(async () => {
    await AsyncStorage.removeItem(KEY_AUTH);
    setIsAuthenticated(false);
  }, []);

  // keep notifications prefs stubbed to avoid undefined reads elsewhere
  const value = React.useMemo(() => ({
    // what SplashAuth expects:
    isHydrated,
    getPin,
    setPin,
    clearPin,

    // simple auth:
    isAuthenticated,
    login,
    logout,

    // lightweight “state/actions” shape if other screens read these:
    state: {
      authLoaded: isHydrated,
      isAuthenticated,
      prefs: { notifications: { enabled: false, dailyTime: '09:00' } },
    },
    actions: {
      setPrefs: async () => {},
      login,
      logout,
    },
  }), [isHydrated, isAuthenticated, getPin, setPin, clearPin, login, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
