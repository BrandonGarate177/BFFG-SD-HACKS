import type { FilterSpecification } from "maplibre-gl";
import { monthsToDays } from "../../../shared/format";
import {
  ARCHETYPES,
  ARCHETYPE_MAX_UNITS,
  ARCHETYPE_UNITS,
  archetypeForUnits,
  type Archetype,
} from "../../../shared/domain/archetype";

export type Filters = {
  budgetUsd: number;
  timeframeMonths: number;
  /** Per archetype, because cost per door varies by project size. */
  hardCostPerUnit: Record<Archetype, number>;
  /** Restrict the map to one project size. Null shows every band. */
  archetype: Archetype | null;
};

/**
 * Capacity range for one archetype, as a MapLibre expression. The upper
 * bound is dropped for 5plus, which is open-ended.
 */
function inBand(a: Archetype, units: unknown[]): unknown[] {
  const hi = ARCHETYPE_MAX_UNITS[a];
  const bounds: unknown[][] = [[">=", units, ARCHETYPE_UNITS[a]]];
  if (Number.isFinite(hi)) bounds.push(["<=", units, hi]);
  return ["all", ...bounds];
}

/**
 * Builds the MapLibre style expression for the highlight layer.
 *
 * Runs entirely against attributes baked into the tiles - no fetch, no APN
 * list. MapLibre re-derives render buckets for already-loaded tiles and
 * repaints, so a filter change costs no network round trip.
 *
 * PRICING archetype is always DERIVED from delta_units, matching the training
 * pipeline's assignment rule. That is what makes cost vary per parcel: a fixed
 * archetype would give every parcel an identical cost and the budget slider
 * would stop discriminating. `f.archetype` is a separate thing - a view scope
 * that hides other bands. It never changes how a parcel is priced.
 */
export function toFilter(f: Filters): FilterSpecification {
  const maxDays = monthsToDays(f.timeframeMonths);
  const units = ["get", "delta_units"];

  /**
   * units * hardCost(archetype) <= budget, i.e. units <= budget / hardCost.
   * hardCost depends on the archetype, which depends on units, so the
   * ceiling has to be resolved per band inside the expression rather than
   * computed once - same shape as predDays below, and keyed on the same
   * thresholds so the two can never disagree about which band a parcel is in.
   */
  const affordable = [
    "case",
    ["<=", units, 1], ["<=", units, f.budgetUsd / f.hardCostPerUnit.adu],
    ["==", units, 2], ["<=", units, f.budgetUsd / f.hardCostPerUnit.duplex],
    ["<=", units, 4], ["<=", units, f.budgetUsd / f.hardCostPerUnit["3_4_unit"]],
    ["<=", units, f.budgetUsd / f.hardCostPerUnit["5plus"]],
  ];

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
    // Scoping to one project size makes the cost rate for that size actually
    // bite: at a multi-million budget an ADU parcel is affordable at every
    // rate on the slider, so with all bands showing that control looks dead.
    ...(f.archetype ? [inBand(f.archetype, units)] : []),
    affordable,
    ["<=", predDays, maxDays],
  ] as unknown as FilterSpecification;
}

/**
 * What the budget reaches, and WHICH constraint stops it there.
 *
 * Cost per unit is a step function of unit count, so the largest affordable
 * capacity is not one division: a budget can afford 4 units at the 3-4 rate
 * and still not reach 5 at the 5plus rate. Each band is tested at its own
 * price and only counts if the resulting count lands inside that band.
 *
 * The kind matters as much as the number. Scoped to a closed band, capacity
 * is capped by the band itself rather than by money - an ADU project is one
 * unit however rich you are - so a plain "buys N units" readout freezes and
 * looks broken. Callers report the binding constraint instead.
 */
export type BudgetReach =
  | { kind: "none" }
  | { kind: "money-bound"; units: number }
  | { kind: "band-bound"; archetype: Archetype; units: number; cost: number; spare: number };

export function budgetReach(f: Filters): BudgetReach {
  let best = 0;
  let winner: Archetype | null = null;

  for (const a of ARCHETYPES) {
    if (f.archetype != null && a !== f.archetype) continue;
    const n = Math.min(Math.floor(f.budgetUsd / f.hardCostPerUnit[a]), ARCHETYPE_MAX_UNITS[a]);
    if (n > 0 && archetypeForUnits(n) === a && n > best) {
      best = n;
      winner = a;
    }
  }
  if (winner == null) return { kind: "none" };

  const rate = f.hardCostPerUnit[winner];
  // Only meaningful when scoped: with every band showing, a budget that
  // cannot reach the next band up is still money-bound, not band-bound.
  if (f.archetype == null || Math.floor(f.budgetUsd / rate) <= best) {
    return { kind: "money-bound", units: best };
  }
  const cost = best * rate;
  return { kind: "band-bound", archetype: winner, units: best, cost, spare: f.budgetUsd - cost };
}

/**
 * Why a rate slider cannot change anything at the current budget, if it
 * cannot. Cost only decides a parcel by way of `units * rate <= budget`, so a
 * closed band saturates in both directions: past the top the whole band is
 * affordable at every rate, below the bottom none of it is at any rate.
 * Either way dragging does nothing visible, which reads as a broken control.
 * 5plus is open-ended, so some parcel always flips and it is never inert.
 */
export type RateInertness = "all-affordable" | "none-affordable" | null;

export function rateInertness(f: Filters, a: Archetype, min: number, max: number): RateInertness {
  if (!Number.isFinite(ARCHETYPE_MAX_UNITS[a])) return null;
  if (ARCHETYPE_MAX_UNITS[a] * max <= f.budgetUsd) return "all-affordable";
  if (ARCHETYPE_UNITS[a] * min > f.budgetUsd) return "none-affordable";
  return null;
}
