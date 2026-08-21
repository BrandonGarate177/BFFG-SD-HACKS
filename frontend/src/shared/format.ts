import { DAYS_PER_MONTH } from "./config";

export const monthsToDays = (m: number) => m * DAYS_PER_MONTH;
export const daysToMonths = (d: number) => d / DAYS_PER_MONTH;

export const fmtUSD = (n: number): string =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    : n >= 1_000
      ? `$${Math.round(n / 1000)}k`
      : `$${Math.round(n)}`;

export const fmtUSDExact = (n: number): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtMonths = (m: number): string =>
  m < 12 ? `${m.toFixed(1)} mo` : `${(m / 12).toFixed(1)} yr`;

export const fmtPct = (p: number): string => `${Math.round(p * 100)}%`;

/**
 * Inverse of fmtUSD/fmtUSDExact, tolerant of what people actually type:
 * "$2.5M", "2,500,000", "350k". Returns null for anything unparseable, so a
 * caller rejects the entry rather than silently reading a stray 0.
 */
export const parseUSD = (s: string): number | null => {
  const m = /^(\d+(?:\.\d+)?|\.\d+)([km])?$/.exec(s.trim().toLowerCase().replace(/[$,\s]/g, ""));
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === "k" ? n * 1_000 : m[2] === "m" ? n * 1_000_000 : n;
};

/** Inverse of the "N mo" readout. Also takes years ("2y", "1.5 yr"). */
export const parseMonths = (s: string): number | null => {
  const m = /^(\d+(?:\.\d+)?|\.\d+)(mo|mos|months?|y|yr|yrs|years?)?$/.exec(
    s.trim().toLowerCase().replace(/\s/g, ""),
  );
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2]?.startsWith("y") ? 12 : 1));
};
