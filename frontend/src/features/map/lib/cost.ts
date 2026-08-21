import { HARD_COST_PER_UNIT } from "../config";
import { PRED_DAYS_FIELD, type TileParcel } from "../types";
import { archetypeForUnits, type Archetype } from "../../../shared/domain/archetype";
import { daysToMonths } from "../../../shared/format";

/**
 * Estimated construction cost to build a parcel to its by-right capacity.
 *
 * This is arithmetic over a stated assumption, NOT a model output. The rate
 * is chosen by the parcel's own archetype, so a 1-unit ADU and a 5-unit
 * building are not priced at the same figure per door. See the note in
 * config.ts for where each rate comes from. It deliberately excludes:
 *   - permit_fee and Development Impact Fees (not in the tile schema; they
 *     live in predictions.parquet and surface on the detail page)
 *   - land acquisition (no assessed value in the tile export)
 *   - soft costs, financing, escalation
 *
 * It is therefore a FLOOR on total project cost, and the UI says so.
 */
export function estimatedCost(units: number, hardCostPerUnit: Record<Archetype, number>): number {
  return units * hardCostPerUnit[archetypeForUnits(units)];
}

/** Units a parcel yields when built to capacity. Null capacity means no answer. */
export function buildableUnits(p: Pick<TileParcel, "delta_units">): number | null {
  return p.delta_units == null || p.delta_units <= 0 ? null : p.delta_units;
}

export type ParcelEconomics = {
  units: number;
  archetype: Archetype;
  cost: number;
  predDays: number;
  predMonths: number;
};

/**
 * Everything the popup and detail header need, derived consistently so the
 * map, the popup and the filter can never disagree about a parcel.
 */
export function parcelEconomics(
  p: TileParcel,
  hardCostPerUnit: Record<Archetype, number> = HARD_COST_PER_UNIT,
): ParcelEconomics | null {
  const units = buildableUnits(p);
  if (units == null) return null;

  const archetype = archetypeForUnits(units);
  const predDays = p[PRED_DAYS_FIELD[archetype]] as number;

  return {
    units,
    archetype,
    cost: estimatedCost(units, hardCostPerUnit),
    predDays,
    predMonths: daysToMonths(predDays),
  };
}
