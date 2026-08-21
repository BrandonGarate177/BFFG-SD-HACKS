/**
 * The one domain concept both features share. Map derives it from capacity;
 * Insights receives predictions keyed by it. Neither owns it, so it lives here.
 *
 * Mirrors server/models.py::Archetype.
 */
export type Archetype = "adu" | "duplex" | "3_4_unit" | "5plus";

export const ARCHETYPES: readonly Archetype[] = ["adu", "duplex", "3_4_unit", "5plus"];

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  adu: "ADU",
  duplex: "Duplex",
  "3_4_unit": "3-4 unit",
  "5plus": "5+ unit",
};

/** Training rows behind each archetype. Duplex and 3-4 are thin - flag them. */
export const ARCHETYPE_SUPPORT: Record<Archetype, number> = {
  adu: 8_379,
  duplex: 952,
  "3_4_unit": 900,
  "5plus": 2_017,
};

export const THIN_SUPPORT_THRESHOLD = 1_000;

export function hasThinSupport(a: Archetype): boolean {
  return ARCHETYPE_SUPPORT[a] < THIN_SUPPORT_THRESHOLD;
}

/**
 * The archetype a parcel falls into when built to full by-right capacity.
 * Mirrors the training pipeline's assignment rule, which keyed on
 * APPROVAL_DU_NET_CHANGE.
 */
export function archetypeForUnits(units: number): Archetype {
  if (units <= 1) return "adu";
  if (units === 2) return "duplex";
  if (units <= 4) return "3_4_unit";
  return "5plus";
}
