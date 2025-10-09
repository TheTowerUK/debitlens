// src/utils/csv.js
export function toCSV(rows) {
  // rows: array of arrays or array of objects
  if (!rows?.length) return '';

  const isObj = !Array.isArray(rows[0]);
  const headers = isObj ? Object.keys(rows[0]) : null;

  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [];
  if (isObj) lines.push(headers.map(esc).join(','));
  for (const row of rows) {
    if (isObj) {
      lines.push(headers.map((h) => esc(row[h])).join(','));
    } else {
      lines.push(row.map(esc).join(','));
    }
  }
  return lines.join('\n');
}
