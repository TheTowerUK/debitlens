// src/utils/moneyUtils.ts

const SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  INR: '₹',
};

/** Extracts currency preferences from contributor or app settings */
export function getCurrencyFromPrefs(prefs: any): {
  code: string;
  symbol: string;
  locale?: string;
} {
  const code = String(prefs?.currencyCode || prefs?.currency || 'GBP').toUpperCase();
  const symbol = prefs?.currencySymbol || SYMBOLS[code] || '¤';
  const locale = prefs?.locale || undefined;
  return { code, symbol, locale };
}

/** Formats a money value using Intl or fallback */
export function money(value: number, prefs: any, { abs = true } = {}): string {
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

/** Returns '+' or '-' based on value */
export function sign(v: number): string {
  return Number(v) < 0 ? '-' : '+';
}

/** Formats a signed delta value */
export function formatDelta(value: number, prefs: any): string {
  const s = sign(value);
  return `${s}${money(Math.abs(value), prefs)}`;
}

/** Parses a money string into a number */
export function parseMoney(str: string): number {
  const clean = String(str || '').replace(/[^\d.-]/g, '');
  const n = Number(clean);
  return isFinite(n) ? n : 0;
}

/** Returns symbol for a given currency code */
export function getSymbol(code: string): string {
  return SYMBOLS[String(code).toUpperCase()] || '¤';
}
