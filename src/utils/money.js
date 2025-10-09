// src/utils/money.js
const SYMBOLS = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  INR: '₹',
};

export function getCurrencyFromPrefs(prefs) {
  const code = String(prefs?.currencyCode || prefs?.currency || 'GBP').toUpperCase();
  const symbol = prefs?.currencySymbol || SYMBOLS[code] || '¤';
  const locale = prefs?.locale || undefined; // e.g., 'en-GB'
  return { code, symbol, locale };
}

/** Formats a money value. Defaults to absolute value (no sign). */
export function money(value, prefs, { abs = true } = {}) {
  const { code, symbol, locale } = getCurrencyFromPrefs(prefs);
  const n = Number(value || 0);
  const v = abs ? Math.abs(n) : n;

  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);

    if (!fmt.includes(symbol) && SYMBOLS[code]) return `${symbol}${v.toFixed(2)}`;
    return fmt;
  } catch {
    return `${symbol}${v.toFixed(2)}`;
  }
}

export function sign(v) {
  return Number(v) < 0 ? '-' : '+';
}
