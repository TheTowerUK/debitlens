// src/utils/importSummary.ts
import type { RowIssue } from './validation';

export type ImportSummary = {
  imported: number;
  skipped: number;
  warnings: RowIssue[];
  errors: RowIssue[];
};
