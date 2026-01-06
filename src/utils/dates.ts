// src/utils/dates.ts

// Returns 'YYYY-MM-DD' or null if it can't parse.
export function normalizeDateToYMD(input: unknown): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;

  // Already YYYY-MM-DD
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
  const m1 = s.match(ymd);
  if (m1) {
    const y = Number(m1[1]);
    const m = Number(m1[2]);
    const d = Number(m1[3]);
    return isValidYMD(y, m, d) ? s : null;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;
  const m2 = s.match(dmy);
  if (m2) {
    const d = Number(m2[1]);
    const m = Number(m2[2]);
    const y = Number(m2[3]);
    return isValidYMD(y, m, d) ? fmtYMD(y, m, d) : null;
  }

  // ISO datetime or other date-like strings -> try Date()
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const d = dt.getDate();
    return isValidYMD(y, m, d) ? fmtYMD(y, m, d) : null;
  }

  return null;
}

function fmtYMD(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isValidYMD(y: number, m: number, d: number) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  // Precise check: ensure Date round-trips
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}
