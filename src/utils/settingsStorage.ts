import AsyncStorage from '@react-native-async-storage/async-storage';

/** PIN is the source of truth for app security (stored separately for AppContext sync). */
export const STORAGE_KEY_PIN = '@debitlens/pin:v1';

const STORAGE_KEY_SETTINGS = '@debitlens/settings:v2';

/** Legacy keys migrated into settings v2 */
const LEGACY_BIOMETRICS = '@debitlens/biometricsEnabled:v1';
const LEGACY_SESSION_TIMEOUT = '@debitlens/sessionTimeoutMinutes:v1';
const LEGACY_LAST_UNLOCKED = '@debitlens/lastUnlockedAt:v1';

export type SessionTimeoutMinutes = 5 | 10 | 15;

export type SecuritySettings = {
  biometricsEnabled: boolean;
  sessionTimeoutMinutes: SessionTimeoutMinutes;
  /** Updated when app goes to background/inactive (auto-lock reference). */
  lastActiveAt: number | null;
  /** Updated on successful PIN or biometric unlock. */
  lastUnlockedAt: number | null;
};

export type NotificationSettings = {
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  weeklySummaryEnabled: boolean;
  weeklySummaryDay: number;
  weeklySummaryTime: string;
  remindersEnabled: boolean;
};

type SettingsV2 = {
  version: 2;
  security: SecuritySettings;
  notifications: NotificationSettings;
};

const DEFAULT_SECURITY: SecuritySettings = {
  biometricsEnabled: false,
  sessionTimeoutMinutes: 5,
  lastActiveAt: null,
  lastUnlockedAt: null,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  dailySummaryEnabled: true,
  dailySummaryTime: '09:00',
  weeklySummaryEnabled: false,
  weeklySummaryDay: 2,
  weeklySummaryTime: '09:00',
  remindersEnabled: true,
};

function parseSessionTimeout(raw: string | null): SessionTimeoutMinutes {
  const m = Number(raw);
  if (m === 10 || m === 15 || m === 5) return m;
  return 5;
}

function parseTimestamp(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function safeParseSettings(raw: string | null): SettingsV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SettingsV2>;
    if (parsed?.version !== 2) return null;
    return {
      version: 2,
      security: {
        ...DEFAULT_SECURITY,
        ...(parsed.security ?? {}),
        sessionTimeoutMinutes: parseSessionTimeout(
          String(parsed.security?.sessionTimeoutMinutes ?? 5)
        ),
      },
      notifications: {
        ...DEFAULT_NOTIFICATIONS,
        ...(parsed.notifications ?? {}),
      },
    };
  } catch {
    return null;
  }
}

async function readSettings(): Promise<SettingsV2> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY_SETTINGS);
  const parsed = safeParseSettings(raw);
  if (parsed) return parsed;
  return {
    version: 2,
    security: { ...DEFAULT_SECURITY },
    notifications: { ...DEFAULT_NOTIFICATIONS },
  };
}

async function writeSettings(settings: SettingsV2): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

/** Migrate legacy per-key prefs into settings v2 (idempotent). */
export async function migrateSettingsIfNeeded(): Promise<void> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY_SETTINGS);
  if (safeParseSettings(existing)) return;

  const settings = await readSettings();

  try {
    const [bio, timeout, lastUnlocked] = await Promise.all([
      AsyncStorage.getItem(LEGACY_BIOMETRICS),
      AsyncStorage.getItem(LEGACY_SESSION_TIMEOUT),
      AsyncStorage.getItem(LEGACY_LAST_UNLOCKED),
    ]);

    if (bio === 'true') settings.security.biometricsEnabled = true;
    if (timeout != null) {
      settings.security.sessionTimeoutMinutes = parseSessionTimeout(timeout);
    }
    const unlocked = parseTimestamp(lastUnlocked);
    if (unlocked != null) {
      settings.security.lastUnlockedAt = unlocked;
      settings.security.lastActiveAt = unlocked;
    }

    await writeSettings(settings);

    await Promise.all([
      AsyncStorage.removeItem(LEGACY_BIOMETRICS),
      AsyncStorage.removeItem(LEGACY_SESSION_TIMEOUT),
      AsyncStorage.removeItem(LEGACY_LAST_UNLOCKED),
    ]);
  } catch (e) {
    console.warn('[settingsStorage] migration failed', e);
  }
}

export async function getPinFromStorage(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY_PIN);
  const trimmed = (raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function setPinInStorage(pin: string | null): Promise<void> {
  if (pin == null || pin === '') {
    await AsyncStorage.removeItem(STORAGE_KEY_PIN);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY_PIN, pin);
}

export async function hasPin(): Promise<boolean> {
  const pin = await getPinFromStorage();
  return (pin ?? '').length > 0;
}

export async function loadSecuritySettings(): Promise<SecuritySettings> {
  await migrateSettingsIfNeeded();
  const s = await readSettings();
  const pinExists = await hasPin();
  if (!pinExists && s.security.biometricsEnabled) {
    s.security.biometricsEnabled = false;
    await writeSettings(s);
  }
  return s.security;
}

export async function saveSecuritySettings(
  patch: Partial<SecuritySettings>
): Promise<SecuritySettings> {
  const settings = await readSettings();
  settings.security = { ...settings.security, ...patch };
  if (patch.biometricsEnabled === true) {
    const pinExists = await hasPin();
    if (!pinExists) {
      settings.security.biometricsEnabled = false;
    }
  }
  await writeSettings(settings);
  return settings.security;
}

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  await migrateSettingsIfNeeded();
  const s = await readSettings();
  return s.notifications;
}

export async function saveNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const settings = await readSettings();
  settings.notifications = { ...settings.notifications, ...patch };
  await writeSettings(settings);
  return settings.notifications;
}

/** Call when PIN is removed — disables biometrics and clears lock timestamps. */
export async function clearSecurityOnPinRemove(): Promise<void> {
  const settings = await readSettings();
  settings.security = {
    ...DEFAULT_SECURITY,
    sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes,
  };
  await writeSettings(settings);
}

export async function clearAllSettings(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEY_PIN),
    AsyncStorage.removeItem(STORAGE_KEY_SETTINGS),
    AsyncStorage.removeItem(LEGACY_BIOMETRICS),
    AsyncStorage.removeItem(LEGACY_SESSION_TIMEOUT),
    AsyncStorage.removeItem(LEGACY_LAST_UNLOCKED),
  ]);
}

export async function markLastActiveNow(): Promise<void> {
  const now = Date.now();
  await saveSecuritySettings({ lastActiveAt: now });
}

export async function markUnlockedNow(): Promise<void> {
  const now = Date.now();
  await saveSecuritySettings({ lastActiveAt: now, lastUnlockedAt: now });
}

export async function getSessionTimeoutMs(): Promise<number> {
  const security = await loadSecuritySettings();
  return security.sessionTimeoutMinutes * 60_000;
}

export async function shouldRequireUnlock(): Promise<boolean> {
  const pinExists = await hasPin();
  if (!pinExists) return false;

  const security = await loadSecuritySettings();
  const reference = security.lastActiveAt ?? security.lastUnlockedAt;
  if (reference == null) return false;

  const elapsed = Date.now() - reference;
  return elapsed >= security.sessionTimeoutMinutes * 60_000;
}

export function notificationSettingsToPrefs(
  n: NotificationSettings
): import('./notifications').NotificationPrefs {
  return {
    dailyEnabled: n.dailySummaryEnabled,
    dailyTime: n.dailySummaryTime,
    weeklyEnabled: n.weeklySummaryEnabled,
    weeklyDay: n.weeklySummaryDay,
    weeklyTime: n.weeklySummaryTime,
  };
}
