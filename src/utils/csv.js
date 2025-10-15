// src/utils/csv.js
// Small CSV parser that handles quotes and commas.
// Returns { headers: string[], rows: string[][] }
export function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        cur.push(field);
        field = '';
      } else if (c === '\r') {
        // ignore
      } else if (c === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  // last field
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => String(h || '').trim());
  return { headers, rows: rows.slice(1) };
}

// normalise a date into YYYY-MM-DD if possible
export function toISODate(s) {
  if (!s) return '';
  const t = String(s).trim();
  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // DD/MM/YYYY
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    const dd = String(d).padStart(2, '0');
    const mm = String(mo).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  // last resort: Date parsing (may vary)
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return '';
}

export function rowHash(obj) {
  // stable hash based on key fields
  const base = [
    obj.date || '',
    obj.amount != null ? Number(obj.amount).toFixed(2) : '',
    obj.type || '',
    (obj.accountName || obj.accountId || ''),
    (obj.category || ''),
    (obj.note || '')
  ].join('|');
  let h = 0;
  for (let i = 0; i < base.length; i++) h = ((h << 5) - h) + base.charCodeAt(i) | 0;
  return String(h);
}

