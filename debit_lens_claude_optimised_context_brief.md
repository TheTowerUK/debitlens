# DebitLens — Claude Optimised Context Brief (Short)

---

## APP SUMMARY

**DebitLens** is a personal finance mobile app focused on **tracking, organising, and understanding recurring payments and transactions**.

Core value:
→ Clear visibility of direct debits, subscriptions, and spending patterns

Platform: React Native (Expo) — iOS first (TestFlight)

Status: **Stable core build (Option B architecture) with ongoing UX refinement and App Store preparation**

---

## CORE ARCHITECTURE

- **Frontend:** React Native + Expo
- **Language:** TypeScript
- **State:** Context API (`useApp`) + hooks
- **Storage:** AsyncStorage (local-first)
- **Design:** Offline-first

Key principle:
→ **All data flows through central AppContext**

---

## KEY FILES

- `/state/AppContext.tsx` → global state + actions
- `/screens/DashboardScreen.tsx` → main overview
- `/screens/AccountScreen.tsx` → account + transactions
- `/screens/TxnEditorScreen.tsx` → add/edit transactions
- `/screens/DataTransferScreen.tsx` → CSV + JSON import/export
- `/hooks/useDataExportImport.ts` → import/export logic
- `/screens/SplashAuthScreen.tsx` → PIN + biometrics

---

## WHAT WORKS (DO NOT REBUILD)

- Account management (multiple accounts)
- Transaction tracking (income, expense, transfer)
- Recurring payments system
- CSV import (batch processing + mapping)
- JSON backup + restore
- Data transfer screen (Pick → Review → Commit flow)
- PIN + biometric authentication
- App reset + data wipe flow

---

## CURRENT FOCUS

1. UX refinement:
   - Data import clarity
   - Dashboard improvements
   - Navigation simplification

2. Data import enhancements:
   - Validation summary
   - Error handling

3. App Store readiness:
   - Polish UI
   - TestFlight feedback

4. Optional enhancements:
   - Encryption for backups
   - Reporting features

---

## KNOWN RISKS

- CSV import edge cases (format variations)
- Data consistency during batch imports
- UX complexity in data transfer flows

---

## DESIGN PRINCIPLES

- **Clarity over complexity**
- **Financial data must be trustworthy and predictable**
- **Minimise user confusion in import/export flows**
- Clean, structured UI

---

## RULES (IMPORTANT)

DO:
- Use AppContext for all state changes
- Keep data transformations predictable
- Maintain backward compatibility for stored data

DON'T:
- Introduce backend yet
- Break existing import/export flows
- Add complexity without UX benefit

---

## CURRENT GOAL

→ Stable, user-friendly financial tracking app
→ Ready for wider TestFlight testing and App Store submission

---

## QUICK PROMPT FOR CLAUDE

```
I am working on DebitLens (React Native finance app).

Core features are complete. Do NOT rebuild existing flows.

Task:
Improve UX and stability around data import/export and dashboard.

Focus on:
- AppContext
- DataTransferScreen
- CSV import logic

Goal:
App Store ready build with clean UX and no data issues.
```

