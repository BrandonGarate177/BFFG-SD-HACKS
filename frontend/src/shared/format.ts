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
