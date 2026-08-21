import type { FilterSpecification } from "maplibre-gl";
import { monthsToDays } from "../../../shared/format";

export type Filters = {
  budgetUsd: number;
  timeframeMonths: number;
  hardCostPerUnit: number;
};

/**
 * Builds the MapLibre style expression for the highlight layer.
 *
 * Runs entirely against attributes baked into the tiles - no fetch, no APN
 * list. MapLibre re-derives render buckets for already-loaded tiles and
 * repaints, so a filter change costs no network round trip.
 *
 * Archetype is DERIVED from delta_units rather than picked by the user,
 * matching the training pipeline's assignment rule. That is what makes
 * cost vary per parcel: a fixed archetype would give every parcel an
 * identical cost and the budget slider would stop discriminating.
 */
export function toFilter(f: Filters): FilterSpecification {
  const maxDays = monthsToDays(f.timeframeMonths);
  const units = ["get", "delta_units"];

  /** delta_units * hardCost <= budget, i.e. units <= budget / hardCost. */
  const maxUnits = f.budgetUsd / f.hardCostPerUnit;

  /**
   * Which pred_days_* column applies, resolved inside the expression so it
   * tracks each feature's own capacity. Mirrors archetypeForUnits().
   */
  const predDays = [
    "case",
    ["<=", units, 1], ["get", "pred_days_adu"],
    ["==", units, 2], ["get", "pred_days_duplex"],
    ["<=", units, 4], ["get", "pred_days_3_4_unit"],
    ["get", "pred_days_5plus"],
  ];

  return [
    "all",
    // Excludes non-residential zones, where delta_units is null. A null
    // fails every comparison, so it drops out here rather than rendering
    // as a zero-capacity parcel.
    [">", units, 0],
    ["<=", units, maxUnits],
    ["<=", predDays, maxDays],
  ] as unknown as FilterSpecification;
}

/**
 * Range of capacities the current budget admits. Used for the readout, so
 * the user can see what the money buys before reading the map.
 */
export function unitsAffordable(f: Filters): number {
  return Math.floor(f.budgetUsd / f.hardCostPerUnit);
}
