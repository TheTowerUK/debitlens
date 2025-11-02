const fs = require('fs');
const path = require('path');
const os = require('os');

// src/services/reporting.ts
// Reporting helpers: build SQL and arguments for report queries and run them
// Keep types explicit so callers and TypeScript know the expected shape.

export type ReportDefinition = {
  id: string;
  name?: string;
  type?: string;
  params?: ReportFilter;
  createdAt?: string;
  updatedAt?: string;
};

export type ReportFilter = {
  dateFrom?: string; // ISO date 'YYYY-MM-DD'
  dateTo?: string; // ISO date 'YYYY-MM-DD'
  accountIds?: string[]; // account id strings
  categoryIds?: string[]; // category id strings
  // add other filter fields as needed
};

export type ReportRow = {
  id: string;
  date: string; // ISO date
  amount: number;
  type: string;
  account_id: string;
  category_id: string | null;
  note?: string | null;
};

/**
 * Return a SQL placeholder list for an array length:
 *   placeholders(['a','b','c']) -> "(?,?,?)"
 */
function placeholders(arr: unknown[] = []): string {
  if (!arr || arr.length === 0) return '(NULL)'; // keeps SQL valid when empty
  return `(${arr.map(() => '?').join(',')})`;
}

/**
 * inclusiveToEndOfDay('2025-11-02') -> '2025-11-02 23:59:59'
 * Handles simple ISO-date strings used as date filters.
 */
export function inclusiveToEndOfDay(isoDate?: string): string | undefined {
  if (!isoDate) return undefined;
  // If input already contains time, return as-is
  if (isoDate.includes('T') || isoDate.includes(' ')) return isoDate;
  return `${isoDate} 23:59:59`;
}

/**
 * Build a parametrised SQL query and args for a transactions report.
 * Returns { sql, args } so callers can run it using their DB layer.
 */
export function buildReportQuery(filter: ReportFilter) {
  const where: string[] = [];
  const args: any[] = [];

  // handle inclusive end-of-day for dateTo if present
  if (filter.dateTo) {
    const nextDay = inclusiveToEndOfDay(filter.dateTo);
    if (nextDay) {
      where.push(`date <= ?`);
      args.push(nextDay);
    }
  }

  if (filter.dateFrom) {
    where.push(`date >= ?`);
    args.push(filter.dateFrom);
  }

  if (filter.accountIds && filter.accountIds.length > 0) {
    where.push(`account_id IN ${placeholders(filter.accountIds)}`);
    args.push(...filter.accountIds);
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    where.push(`category_id IN ${placeholders(filter.categoryIds)}`);
    args.push(...filter.categoryIds);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
    SELECT id, date, amount, type, account_id, category_id, note
    FROM transactions
    ${whereClause}
    ORDER BY date ASC
  `.trim();

  return { sql, args };
}

/**
 * Run the report query against a DB executor.
 *
 * The executor should be a function that accepts (sql: string, args?: any[])
 * and returns a Promise resolving to an array of rows. Example signature:
 *   type Executor = (sql: string, args?: any[]) => Promise<any[]>;
 *
 * This keeps the reporting module agnostic to which DB library you use.
 */
export async function getReport(
  executor: (sql: string, args?: any[]) => Promise<any[]>,
  filter: ReportFilter = {}
): Promise<ReportRow[]> {
  const { sql, args } = buildReportQuery(filter);
  const rows = await executor(sql, args);

  // Normalize row shapes to ReportRow where possible
  return (rows || []).map((r: any) => ({
    id: String(r.id),
    date: String(r.date),
    amount: typeof r.amount === 'number' ? r.amount : Number(r.amount || 0),
    type: String(r.type || ''),
    account_id: String(r.account_id || ''),
    category_id: r.category_id == null ? null : String(r.category_id),
    note: r.note == null ? null : String(r.note),
  }));
}

// -------------------- CSV export helpers --------------------

/**
 * Convert an array of ReportRow to a CSV string.
 * Returns a UTF-8 CSV (headers + rows).
 */
export function generateReportCSV(rows: ReportRow[]): string {
  const headers = ['id', 'date', 'amount', 'type', 'account_id', 'category_id', 'note'];
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = rows.map((r) =>
    [
      r.id,
      r.date,
      r.amount,
      r.type,
      r.account_id,
      r.category_id ?? '',
      r.note ?? '',
    ].map(esc).join(',')
  );
  return `${headers.join(',')}\n${lines.join('\n')}`;
}

type SaveReportOptions = {
  // if true, will attempt to write the CSV to the provided filePath (or a fallback filePath)
  writeToFile?: boolean;
  // optional path to write to; if omitted and writeToFile true, uses FileSystem cacheDirectory + 'report-<ts>.csv'
  filePath?: string;
};

// Convenience helper: run a saved report (by its params) and save the CSV
export async function saveReportFromDefinition(
  executor: (sql: string, args?: any[]) => Promise<any[]>,
  def: ReportDefinition,
  options: { writeToFile?: boolean; filePath?: string } = {}
): Promise<{ csv: string; writtenPath?: string | null }> {
  // Run using the same query builder used elsewhere
  const rows = await getReport(executor, def?.params ?? {});
  // Reuse the CSV writer (and optional file write)
  return saveReport(rows, options);
}

// -------------------- Saved-report storage helpers --------------------

// Minimal shape for a saved report/template stored in the DB
export type SavedReport = {
  id: string;
  name?: string;
  type?: string;
  params?: ReportFilter;
  createdAt?: string;
  updatedAt?: string;
};

// List saved reports from storage.
// executor: (sql, args?) => Promise<any[]>
export async function listReports(
  executor: (sql: string, args?: any[]) => Promise<any[]>
): Promise<SavedReport[]> {
  // Example SQL - adjust table/column names to match your schema
  const sql = `
    SELECT id, name, type, params, created_at AS createdAt, updated_at AS updatedAt
    FROM saved_reports
    ORDER BY updated_at DESC
  `.trim();

  const rows = await executor(sql, []);
  return (rows || []).map((r: any) => {
    let params: ReportFilter | undefined = undefined;
    try {
      params = r.params ? JSON.parse(r.params) : undefined;
    } catch {
      params = undefined;
    }
    return {
      id: String(r.id),
      name: r.name == null ? undefined : String(r.name),
      type: r.type == null ? undefined : String(r.type),
      params,
      createdAt: r.createdAt ? String(r.createdAt) : undefined,
      updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
    };
  });
}

// Delete a saved report by id.
// executor: (sql, args?) => Promise<any>  — should run a delete command
export async function deleteReport(
  executor: (sql: string, args?: any[]) => Promise<any>,
  id: string
): Promise<void> {
  // Example SQL - adjust table name to match your schema
  const sql = 'DELETE FROM saved_reports WHERE id = ?';
  await executor(sql, [id]);
}
export async function saveReport(
  rows: ReportRow[],
  options: { writeToFile?: boolean; filePath?: string }
): Promise<{ csv: string; writtenPath?: string | null }> {
  const csv = generateReportCSV(rows || []);

  if (!options?.writeToFile) {
    return { csv, writtenPath: null };
  }

  // Determine target path (try to pick a sensible temp/cache location in Node)
  let targetPath = options.filePath || null;

  try {
    // Try Node.js fs/path/os first (works in typical server environments)
    // Use require to avoid top-level import issues in mixed environments.
    // If require isn't available, dynamic import will throw and we'll fall back.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // eslint-disable-next-line @typescript-eslint/no-var-requires

    if (!targetPath) {
      const dir = (os && typeof os.tmpdir === 'function') ? os.tmpdir() : process.cwd();
      targetPath = path.join(dir, `report-${Date.now()}.csv`);
    }

    // Prefer fs.promises when available
    if (fs.promises && typeof fs.promises.writeFile === 'function') {
      await fs.promises.writeFile(targetPath, csv, 'utf8');
    } else if (typeof fs.writeFileSync === 'function') {
      fs.writeFileSync(targetPath, csv, 'utf8');
    } else {
      // fs present but no write APIs we can use
      return { csv, writtenPath: null };
    }

    return { csv, writtenPath: targetPath };
  } catch {
    // Not running in Node or file write failed; fail gracefully and return CSV only.
    return { csv, writtenPath: null };
  }
}


