/** Cross-feature constants. Feature-local constants live in the feature. */

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

/** From data/predictions_meta.json. Shown alongside any prediction, never hidden. */
export const MODEL = {
  cIndex: 0.612,
  cIndexBaselineCox: 0.574,
  cIndexChance: 0.5,
  asOfDate: "2026-08-20",
  parcels: 393_755,
} as const;

export const DAYS_PER_MONTH = 30.44;
