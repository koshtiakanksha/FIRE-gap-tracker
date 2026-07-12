/**
 * Display formatting helpers. Pure functions, no UI imports — kept separate
 * from fireCalculations.ts so the math stays untangled from presentation.
 */

/** Formats a dollar amount with no cents, e.g. 1500000 -> "$1,500,000". */
export function formatCurrency(value: number): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact currency for tight spaces, e.g. 1500000 -> "$1.5M". */
export function formatCurrencyCompact(value: number): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Formats a percent value (already in 0-100 scale), e.g. 42.345 -> "42.3%". */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

/** Formats a number of years, e.g. 7.83 -> "7.8 years". Singular for ~1. */
export function formatYears(value: number | null): string {
  if (value === null || !isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 1) return "1 year";
  return `${rounded} years`;
}

/** Formats an age, e.g. 47.3 -> "47". Ages are shown as whole numbers in the UI. */
export function formatAge(value: number | null): string {
  if (value === null || !isFinite(value)) return "—";
  return Math.round(value).toString();
}
