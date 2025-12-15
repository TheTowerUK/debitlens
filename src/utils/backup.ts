// src/utils/backup.ts
import type { Account, Transaction, RecurringItem } from '../state/AppContext';

export type BackupV1 = {
  version: 1;
  exportedAt: string; // ISO
  app: {
    accounts: Account[];
    transactions: Transaction[];
    recurring: RecurringItem[];
  };
};

export function createBackupV1(input: {
  accounts: Account[];
  transactions: Transaction[];
  recurring?: RecurringItem[];
}): BackupV1 {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: {
      accounts: input.accounts || [],
      transactions: input.transactions || [],
      recurring: input.recurring || [],
    },
  };
}

export function parseAndValidateBackup(jsonText: string): BackupV1 {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Backup format invalid (not an object).');
  }
  if (data.version !== 1) {
    throw new Error(`Unsupported backup version: ${String(data.version)}`);
  }
  if (!data.app || typeof data.app !== 'object') {
    throw new Error('Backup format invalid (missing app).');
  }
  if (!Array.isArray(data.app.accounts) || !Array.isArray(data.app.transactions)) {
    throw new Error('Backup format invalid (accounts/transactions).');
  }

  // Backwards-compatible: if older backups don't have recurring, default it
  if (!Array.isArray(data.app.recurring)) {
    data.app.recurring = [];
  }

  // light sanity
  for (const a of data.app.accounts) {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string') {
      throw new Error('Backup invalid: an account is missing an id.');
    }
  }
  for (const t of data.app.transactions) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string') {
      throw new Error('Backup invalid: a transaction is missing an id.');
    }
  }

  return data as BackupV1;
}
