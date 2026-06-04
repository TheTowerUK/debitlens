# Security model

DebitLens is local-first: financial data stays on the device unless the user explicitly exports a backup or CSV through the OS share sheet.

Technical storage map: [platform.md](../platform/platform.md) (Local State Keys, External Connections).

## Data storage

- All application data stored locally on device.
- No cloud synchronisation.
- No backend services.

Primary persistence uses AsyncStorage for app state (accounts, transactions, recurring items, budgets). Security and notification preferences are stored in `@debitlens/settings:v2` via `src/utils/settingsStorage.ts`. The PIN is stored separately at `@debitlens/pin:v1` and is the source of truth for app security.

## Authentication

- Optional PIN (4–6 digits).
- Optional biometric unlock (Face ID / fingerprint), only when a PIN is set.

**Rules:**

- Biometrics cannot be enabled without an existing PIN.
- Removing the PIN disables biometrics and clears auto-lock timestamps.
- Enabling biometrics in Settings requires a successful device authentication prompt.

**Unlock flows:**

- **Sign in:** `Login` with existing PIN.
- **Set PIN:** Settings → Set PIN, or first-time `Login` create flow.
- **Change PIN:** Settings → Change PIN → verify current PIN → enter new PIN twice.
- **Remove PIN:** Settings → Remove PIN → verify current PIN → confirm removal.

When the app returns from background after the configured auto-lock period, `App.tsx` attempts biometric unlock if enabled; on failure or cancel, the user is sent to the PIN screen.

## Auto-lock

- Configurable timeout: 5, 10, or 15 minutes (Settings → Auto-lock).
- When the app goes to background or inactive, the current time is saved as `lastActiveAt`.
- When the app becomes active again, if elapsed time exceeds the timeout, unlock is required.
- **Lock now** and **Lock app** in Settings return to the PIN screen without removing the PIN.

## Notifications (local only)

Notification toggles (daily summary, weekly summary, reminders preference) are persisted in `@debitlens/settings:v2` and survive app restart. Scheduled jobs use `expo-notifications` on device only; no financial data is sent to external services.

## Backup security

- Plain JSON backups supported.
- Optional encrypted backups using PBKDF2 + AES.

Backups are created and restored by the user via file pickers and the system share sheet. Encrypted backups use a user-chosen passcode; decryption happens on device only. Incorrect passcodes fail before any restore is applied.

## Data transmission

- No transmission of financial data to external services.

The app does not call remote APIs for account or transaction data. Network use, if any, is limited to build/distribution tooling (Expo/EAS) and does not sync user financial records.
