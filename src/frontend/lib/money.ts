// Money helpers. All amounts are integer minor units.

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XOF", "XAF"]);

export function minorUnitsPer(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}

export function formatMoney(minor: number, currency: string, opts?: { signed?: boolean }): string {
  const factor = minorUnitsPer(currency);
  const value = minor / factor;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: factor === 1 ? 0 : 2,
    maximumFractionDigits: factor === 1 ? 0 : 2,
  }).format(Math.abs(value));
  if (opts?.signed) {
    if (minor > 0) return `+${formatted}`;
    if (minor < 0) return `-${formatted}`;
    return formatted;
  }
  return minor < 0 ? `-${formatted}` : formatted;
}

/** Parse a user-typed decimal string ("12.50") into minor units. Returns null if invalid. */
export function parseMoney(input: string, currency: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const factor = minorUnitsPer(currency);
  const [whole, frac = ""] = trimmed.split(".");
  if (factor === 1) return Number(whole);
  const cents = (frac + "00").slice(0, 2);
  return Number(whole) * 100 + Number(cents);
}

/** Convert minor units to a decimal string for inputs. */
export function toDecimalString(minor: number, currency: string): string {
  const factor = minorUnitsPer(currency);
  if (factor === 1) return String(minor);
  return (minor / 100).toFixed(2);
}

/** Split `total` equally among `count` participants; remainder goes to the first few. */
export function splitEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

export const CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "CAD", "AUD", "JPY", "INR", "CHF", "SEK", "ZAR", "KES", "GHS", "BRL", "MXN",
];
