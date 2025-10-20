// src/db/migrations/004_accounts.js
export const id = 4; // must be higher than any already-applied migration

export const up = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_archived ON accounts(archived);

-- seed a safe fallback account used for reassignment
INSERT OR IGNORE INTO accounts (id, name, type) VALUES ('unassigned', 'Unassigned', NULL);
`;
