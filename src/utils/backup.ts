// src/utils/backup.ts
import type { Account, Transaction, RecurringItem, Budget } from '../state/AppContext';

export type BackupV1 = {
  version: 1;
  createdAt: string;
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
  budgets: Budget[]; // ✅ add
  currency?: string;
};

export type BackupLatest = {
  version: 1;
  exportedAt: string;
  app: {
    accounts: Account[];
    transactions: Transaction[];
    recurring: RecurringItem[];
    budgets: Budget[]; // ✅ add
  };
  currency?: string;
};

type CreateBackupV1Input = {
  accounts: Account[];
  transactions: Transaction[];
  recurring?: RecurringItem[];
  budgets?: Budget[]; // ✅ add
  currency?: string;
};

export function createBackupV1(input: CreateBackupV1Input): BackupV1 {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    accounts: input.accounts || [],
    transactions: input.transactions || [],
    recurring: input.recurring || [],
    budgets: input.budgets || [], // ✅ add
    currency: input.currency,
  };
}

export function parseAndValidateBackup(jsonText: string): BackupLatest {
  let raw: any;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  // v1 shape (your current exporter)
  if (raw?.version === 1 && Array.isArray(raw?.accounts) && Array.isArray(raw?.transactions)) {
    return {
      version: 1,
      exportedAt: String(raw.createdAt || raw.exportedAt || new Date().toISOString()),
      app: {
        accounts: raw.accounts || [],
        transactions: raw.transactions || [],
        recurring: Array.isArray(raw.recurring) ? raw.recurring : [],
        budgets: Array.isArray(raw.budgets) ? raw.budgets : [], // ✅ add (backwards compatible)
      },
      currency: raw.currency,
    };
  }

  throw new Error('Unrecognised backup format.');
}
