# DebitLens Platform Overview

## Platform Overview

DebitLens is a local-first Expo React Native app: financial data stays on the device unless the user explicitly exports backups or CSV via the OS share sheet. No backend endpoints are configured in the app code.

This document serves three roles:

| Role | What it covers |
| --- | --- |
| **Architecture overview** | Runtime stack, storage model, optional encryption |
| **Integration map** | External connections (OS APIs, file I/O, notifications) and data interchange formats |
| **Operational reference** | Build and release path, platform identifiers, versioning |

**Delivery path:** GitHub repository → Expo / EAS Build → App Store Connect (iOS) / Google Play Console (Android) → end users.

**Development tooling:** Cursor, VS Code, Git, GitHub.

See also: [security.md](../product/security.md) (full security model), [platform-ids.md](./platform-ids.md) (IDs and URLs).

## External Connections

| Connection surface | Implemented with | User trigger / flow (high level) | Primary platforms |
| --- | --- | --- | --- |
| Client runtime (iOS / Android / Web) | Expo React Native + navigation | App routes + session watcher decides when to route to `Login` | iOS, Android, Web |
| Local unlock / session locking | `settingsStorage` + `expo-local-authentication` + PIN (`Login` screen) | On background, `lastActiveAt` is saved; on resume after auto-lock timeout, biometrics is tried first (if enabled), then PIN | iOS, Android (device capabilities) |
| Local persistence (core data) | AsyncStorage (debounced app state) | Accounts, transactions, recurring items, and budgets are serialized and persisted as JSON | iOS, Android, Web |
| Backup reminder scheduler | Local notifications via `expo-notifications` | User toggles weekly/monthly backup reminders from Backup & Restore screen | Android (channel), iOS (local notification support) |
| JSON backup export | File write via `expo-file-system` + share via `expo-sharing` | User presses export; app writes a JSON backup to `documentDirectory` and triggers OS share/save to Files | iOS, Android |
| Encrypted JSON backup export (optional) | Local encryption via `crypto-js` (PBKDF2 + AES) | If enabled, user enters passcode; backup is wrapped in an encrypted envelope before being written/shared | iOS, Android |
| JSON backup restore | File pick via `expo-document-picker` + read via `expo-file-system` | User selects a JSON backup; if encrypted envelope is detected, app requests passcode, decrypts, validates, then applies restore | iOS, Android |
| CSV transactions export | Generate CSV + file write/share | User generates transactions CSV text, writes it to `documentDirectory`, then shares it to Files | iOS, Android |
| CSV transactions import | File pick/read + parsing + restore batching | User selects a CSV; app reads text, validates required headers, parses rows, and applies import in batches (pending state stored for recovery) | iOS, Android |

## Data Interchange Formats

Portable artifacts DebitLens moves between the app and the device OS/files.

| Format artifact | Shape / generator | What’s inside / semantics | Where it’s used |
| --- | --- | --- | --- |
| Backup JSON (plain) | `createBackupV1` → JSON object shape v1 | Includes: accounts, transactions, recurring, budgets | De/serialize locally; no backend |
| Encrypted backup JSON (optional) | Encrypted envelope: `{ encrypted: true, kdf: pbkdf2, cipher: aes, ... }` | Passcode derives a key using PBKDF2 (SHA-256), then decrypts with AES + IV | Decryption is local and requires the passcode |
| CSV template | `CSV_TEMPLATE` constant | Template text is written and shared via OS share flow | Used as a format guide for imports |
| CSV transactions export format | Generated CSV with UTF-8 BOM | Rows include: Date, Account, Amount, Description, Merchant, Category, Type | Exported file is shared to Files |

## Local State Keys

Internal AsyncStorage endpoints for persisted state. Security and notification preferences are centralised in `src/utils/settingsStorage.ts` (single module; migrates legacy keys on load).

| Key / storage endpoint | What it stores |
| --- | --- |
| App state | Persistent app data in AppContext: `@debitlens/appState:v1` |
| PIN | Session gate (source of truth for app security): `@debitlens/pin:v1` |
| Settings (v2) | Combined JSON blob `@debitlens/settings:v2` — see below |
| CSV import pending session | Crash recovery for batched CSV import: `debitlens:pendingCsvImport:v1` |
| CSV import stats | Last validation/import summary: `debitlens:lastCsvImportStats:v1` |
| Backup reminder mode + notification id | Saved scheduler settings: `debitlens:backupReminderMode:v1` / `debitlens:backupReminderNotifId:v1` |

**`@debitlens/settings:v2` shape** (migrated from legacy `@debitlens/biometricsEnabled:v1`, `@debitlens/sessionTimeoutMinutes:v1`, `@debitlens/lastUnlockedAt:v1` on first load):

| Field (under `security`) | Purpose |
| --- | --- |
| `biometricsEnabled` | Biometric unlock after auto-lock (only valid when PIN exists) |
| `sessionTimeoutMinutes` | Auto-lock delay: `5`, `10`, or `15` |
| `lastActiveAt` | Timestamp when app last went to background (auto-lock reference) |
| `lastUnlockedAt` | Timestamp of last successful PIN or biometric unlock |

| Field (under `notifications`) | Purpose |
| --- | --- |
| `dailySummaryEnabled` / `dailySummaryTime` | Local daily summary notification (default `09:00`) |
| `weeklySummaryEnabled` / `weeklySummaryDay` / `weeklySummaryTime` | Local weekly summary (default Monday `09:00`) |
| `remindersEnabled` | User preference for reminders (persisted; scheduling may expand later) |

**UI entry points:** Settings → PIN / Biometrics / Auto-lock; Settings → Notification settings (`Notifications` screen). Login flows: `sign`, `create`, `change`, `remove` via `Login` route params.

## Security / Encryption

App-wide security model (storage, auth, transmission): [security.md](../product/security.md).

**In-app security (Sprint 1):**

- PIN is required before biometrics can be enabled; removing PIN clears biometrics and lock timestamps (`clearSecurityOnPinRemove`).
- Auto-lock: `App.tsx` `SessionWatcher` persists `lastActiveAt` on background; resume uses `sessionTimeoutMinutes` from settings v2.
- Failed or cancelled biometric unlock routes to `Login` (PIN), not the main app.
- Change PIN / Remove PIN: dedicated `Login` flows from Settings (`change`, `remove`).

**Backup encryption (optional):**

- Encrypted backups use an envelope flag; decryption is local with the user-provided passcode.
- Primitives: PBKDF2 (SHA-256) → 256-bit AES key; random salt and IV per backup.
- Passcode-derived envelope uses the same file write + OS share flow as plain JSON backups.
- Incorrect passcode: decryption fails before any restore is applied.

**Runtime secrets:** None required for core app (local-first). Configure future API keys via EAS secrets.

## Runtime Stack

- **Framework:** React Native + Expo (~54.0.0)
- **Language:** TypeScript
- **State:** Context API (`useApp`) + hooks
- **Storage:** AsyncStorage (local-first); app data + `settingsStorage` module; `expo-sqlite` and `expo-secure-store` are configured in `app.json` but core app data uses AsyncStorage
- **Settings module:** `src/utils/settingsStorage.ts` (PIN helpers, security + notification prefs, migration)
- **Backend:** None (offline-first)

**Device capabilities used in production flows:**

- CSV and JSON import/export
- Local notifications (budgets, reports, backup reminders)
- PIN and biometric authentication
- Share sheet for backups and CSV (where supported)

## Build & Release

- Expo SDK 54
- EAS Build
- EAS Submit
- Apple Developer / App Store Connect (iOS)
- Google Play Console (Android)

## Platform Identifiers

Quick reference for builds and store submissions. Full table: [platform-ids.md](./platform-ids.md).

| Item | Value |
| --- | --- |
| Website repository | https://github.com/TheTowerUK/debitlens-site |
| Expo slug | `debitlens` |
| URL scheme | `debitlens` |

## Versioning

- User-facing version: `app.json` → `expo.version` (currently `1.0.4`)
- iOS build number: `expo.ios.buildNumber` (currently `9`)
- Android version code: `expo.android.versionCode` (currently `4`)
- EAS: `appVersionSource: remote` with `autoIncrement` on production builds
