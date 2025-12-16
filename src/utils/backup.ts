// src/utils/backup.ts
import type { Account, Transaction, RecurringItem } from '../state/AppContext';

/**
 * Backup schema notes
 * - V1 existed as: { version: 1, exportedAt, app: { accounts, transactions, recurring } }
 * - V2 adds a top-level "meta" block and an optional "settings" block for future use.
 *
 * parseAndValidateBackup() ALWAYS returns BackupV2 (latest).
 */

/* ===========================
   Types
=========================== */

export type BackupV1 = {
  version: 1;
  exportedAt: string; // ISO
  app: {
    accounts: Account[];
    transactions: Transaction[];
    recurring: RecurringItem[];
  };
};

export type BackupV2 = {
  version: 2;
  exportedAt: string; // ISO
  meta: {
    appName: 'DebitLens';
    schema: 'backup';
  };
  app: {
    accounts: Account[];
    transactions: Transaction[];
    recurring: RecurringItem[];
  };
  settings?: {
    currency?: string; // e.g. "GBP"
  };
};

export type BackupLatest = BackupV2;

/* ===========================
   Create backup (latest)
=========================== */

export function createBackupV2(input: {
  accounts: Account[];
  transactions: Transaction[];
  recurring?: RecurringItem[];
  currency?: string;
}): BackupV2 {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    meta: { appName: 'DebitLens', schema: 'backup' },
    app: {
      accounts: input.accounts || [],
      transactions: input.transactions || [],
      recurring: input.recurring || [],
    },
    settings: input.currency ? { currency: input.currency } : undefined,
  };
}

/**
 * Backwards compatible alias:
 * Your screens currently import createBackupV1. Keep that name working,
 * but it now creates the latest schema (v2).
 */
export const createBackupV1 = createBackupV2;

/* ===========================
   Parse + validate + migrate
=========================== */

export function parseAndValidateBackup(jsonText: string): BackupLatest {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Backup format invalid (not an object).');
  }

  const v = data.version;

  if (v === 1) {
    const v1 = validateV1(data);
    return migrateV1toV2(v1);
  }

  if (v === 2) {
    return validateV2(data);
  }

  throw new Error(`Unsupported backup version: ${String(v)}`);
}

/* ===========================
   Validators
=========================== */

function validateV1(x: any): BackupV1 {
  if (x.version !== 1) throw new Error('Not a v1 backup.');
  if (typeof x.exportedAt !== 'string') throw new Error('Backup invalid: exportedAt missing.');
  if (!x.app || typeof x.app !== 'object') throw new Error('Backup invalid: app missing.');

  if (!Array.isArray(x.app.accounts)) throw new Error('Backup invalid: app.accounts missing.');
  if (!Array.isArray(x.app.transactions)) throw new Error('Backup invalid: app.transactions missing.');

  // Back-compat: recurring might be absent in very early builds
  if (!Array.isArray(x.app.recurring)) x.app.recurring = [];

  // Light sanity checks (don’t overfit)
  for (const a of x.app.accounts) {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string') {
      throw new Error('Backup invalid: an account is missing an id.');
    }
  }
  for (const t of x.app.transactions) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string') {
      throw new Error('Backup invalid: a transaction is missing an id.');
    }
  }
  for (const r of x.app.recurring) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') {
      throw new Error('Backup invalid: a recurring item is missing an id.');
    }
  }

  return x as BackupV1;
}

function validateV2(x: any): BackupV2 {
  if (x.version !== 2) throw new Error('Not a v2 backup.');
  if (typeof x.exportedAt !== 'string') throw new Error('Backup invalid: exportedAt missing.');

  if (!x.meta || typeof x.meta !== 'object') {
    throw new Error('Backup invalid: meta missing.');
  }
  // meta is not critical, but keep it reasonable
  if (x.meta.appName !== 'DebitLens') {
    // don’t hard fail; allow different casing/older edits
    // but schema must still be “backup” if present
  }
  if (x.meta.schema && x.meta.schema !== 'backup') {
    throw new Error('Backup invalid: meta.schema must be "backup".');
  }

  if (!x.app || typeof x.app !== 'object') throw new Error('Backup invalid: app missing.');
  if (!Array.isArray(x.app.accounts)) throw new Error('Backup invalid: app.accounts missing.');
  if (!Array.isArray(x.app.transactions)) throw new Error('Backup invalid: app.transactions missing.');
  if (!Array.isArray(x.app.recurring)) x.app.recurring = [];

  // Light sanity checks
  for (const a of x.app.accounts) {
    if (!a || typeof a !== 'object' || typeof a.id !== 'string') {
      throw new Error('Backup invalid: an account is missing an id.');
    }
  }
  for (const t of x.app.transactions) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string') {
      throw new Error('Backup invalid: a transaction is missing an id.');
    }
  }
  for (const r of x.app.recurring) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') {
      throw new Error('Backup invalid: a recurring item is missing an id.');
    }
  }

  // Normalise meta if missing fields
  const meta = {
    appName: 'DebitLens' as const,
    schema: 'backup' as const,
    ...x.meta,
  };

  return {
    ...x,
    meta,
    app: {
      accounts: x.app.accounts,
      transactions: x.app.transactions,
      recurring: x.app.recurring,
    },
  } as BackupV2;
}

/* ===========================
   Migrations
=========================== */

function migrateV1toV2(v1: BackupV1): BackupV2 {
  return {
    version: 2,
    exportedAt: v1.exportedAt,
    meta: { appName: 'DebitLens', schema: 'backup' },
    app: {
      accounts: v1.app.accounts || [],
      transactions: v1.app.transactions || [],
      recurring: v1.app.recurring || [],
    },
    // Default settings can be introduced here later without breaking anything
    settings: undefined,
  };
}
