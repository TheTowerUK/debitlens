# DebitLens Copilot Instructions

## Architecture Overview
DebitLens is a React Native Expo app for personal finance tracking using SQLite database with manual migrations. State is managed centrally via React Context (`src/state/AppContext.tsx`), with database operations in `src/services/`. Screens handle UI logic, components are reusable.

## Key Patterns
- **Database**: Use `src/db/db.ts` executor for queries. Migrations in `src/db/migrations/` with registry in `migrate.ts`.
- **State**: Access via `useApp()` hook from AppContext. Actions like `addAccount`, `updateTransaction` modify state and persist to DB.
- **Navigation**: Stack navigator in `src/navigations/RootNavigator.tsx`. Screens receive params via `NativeStackScreenProps`.
- **Money Formatting**: Use `moneyUtils.ts` with prefs for currency. Always format amounts consistently.
- **Date Handling**: Use `formatDateDDMMYYYY` from `utils/formatDate.ts`. Dates as 'YYYY-MM-DD'.
- **Session Security**: 5-minute inactivity timeout resets to Login screen.

## Developer Workflows
- **Start Dev**: `npm start` (Expo dev server)
- **Build Android/iOS**: `expo run:android` / `expo run:ios`
- **Lint**: `npm run lint` (ESLint)
- **Database Reset**: Use `src/dev/resetDb.ts` for dev data wipe
- **Backup/Restore**: Via `src/utils/backup.ts`, supports JSON/CSV export

## Conventions
- **Imports**: Relative to `src/` via tsconfig paths (e.g., `import { useApp } from 'state/AppContext'`)
- **Types**: Define in `src/types/`, use interfaces for DB entities
- **Components**: Functional with hooks, animations via Reanimated
- **Error Handling**: Wrap DB ops in try/catch, show user-friendly messages
- **File Naming**: PascalCase for components/screens, camelCase for utils/services

## Examples
- Add transaction: `const { addTransaction } = useApp(); addTransaction({ accountId, amount, category });`
- Query accounts: `const accounts = await listAccounts();` from `services/accounts.ts`
- Navigate: `navigation.navigate('TxnEditor', { accountId });`</content>
<parameter name="filePath">d:\AppDev\DebitLens\.github\copilot-instructions.md