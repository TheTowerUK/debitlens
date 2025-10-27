// src/state/AppState.js
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { runMigrations } from '../db/migrate';

useEffect(() => {
  runMigrations().catch(err => {
    console.warn('[DB] startup error', err);
  });
}, []);

const KEY_AUTH = 'auth:loggedIn';
const KEY_PIN  = 'auth:pin';

// Helpers: prefer SecureStore for PIN, fallback to AsyncStorage
async function secureGetItem(key) {
  try { const v = await SecureStore.getItemAsync(key); if (v != null) return v; } catch {}
  try { return await AsyncStorage.getItem(key); } catch {}
  return null;
}
async function secureSetItem(key, value) {
  try { await SecureStore.setItemAsync(key, String(value ?? '')); return; } catch {}
  try { await AsyncStorage.setItem(key, String(value ?? '')); } catch {}
}
async function secureDeleteItem(key) {
  try { await SecureStore.deleteItemAsync(key); return; } catch {}
  try { await AsyncStorage.removeItem(key); } catch {}
}

export const AppContext = React.createContext(undefined);
export function useApp() {
  const ctx = React.useContext(AppContext);
  if (ctx === undefined) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export default function AppProvider({ children }) {
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // Hydrate with a hard timeout so it can never hang
  React.useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => { if (mounted) setIsHydrated(true); }, 1500);

    (async () => {
      try {
        const [logged] = await Promise.all([
          AsyncStorage.getItem(KEY_AUTH),
          // Note: we don't need the PIN value here; Splash reads it on demand
        ]);
        if (!mounted) return;
        setIsAuthenticated(logged === '1');
      } catch (e) {
        console.warn('[AppState] hydrate error', e);
      } finally {
        if (mounted) {
          clearTimeout(timeout);
          setIsHydrated(true);
        }
      }
    })();

    return () => { mounted = false; clearTimeout(timeout); };
  }, []);

  // Methods SplashAuth / Login / Settings may use
  const getPin   = React.useCallback(() => secureGetItem(KEY_PIN), []);
  const setPin   = React.useCallback((v) => secureSetItem(KEY_PIN, v), []);
  const clearPin = React.useCallback(() => secureDeleteItem(KEY_PIN), []);

  const login  = React.useCallback(async () => {
    await AsyncStorage.setItem(KEY_AUTH, '1');
    setIsAuthenticated(true);
  }, []);
  const logout = React.useCallback(async () => {
    await AsyncStorage.removeItem(KEY_AUTH);
    setIsAuthenticated(false);
  }, []);

  const value = React.useMemo(() => ({
    // what SplashAuth needs:
    isHydrated,
    getPin, setPin, clearPin,

    // simple auth:
    isAuthenticated, login, logout,

    // optional shape for other screens that read state/actions:
    state: {
      authLoaded: isHydrated,
      isAuthenticated,
      prefs: { notifications: { enabled: false, dailyTime: '09:00' } },
    },
    actions: { setPrefs: async () => {}, login, logout },
  }), [isHydrated, isAuthenticated, getPin, setPin, clearPin, login, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
