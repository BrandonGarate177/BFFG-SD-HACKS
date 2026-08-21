import type { Archetype } from "../../shared/domain/archetype";

/**
 * Map-feature constants. Nothing outside features/map imports this.
 *
 * The cost figures are ASSUMPTIONS, not model output. The permit dataset
 * does not model construction cost at all (data/README.md: "Construction
 * cost is not modelled at all - out of scope by design"). The server's
 * /search matches budget against `permit_fee`, which is a fee floor and a
 * different quantity entirely. So the map's budget filter is a CALCULATOR
 * with visible, adjustable inputs - never presented as a prediction.
 */

/**
 * Hard (construction) cost per dwelling unit, USD, by project archetype.
 * User-adjustable; each parcel is priced with the row matching its own
 * by-right capacity, because a backyard ADU and a 5-unit building do not
 * cost the same per door. A single blended figure was wrong in opposite
 * directions at the two ends of the map.
 *
 * SCOPE, matching estimatedCost(): construction only. Excludes land, permit
 * fees and DIF, design and other soft costs, and financing. A floor on total
 * project cost, not the whole of it.
 *
 * Sourcing, as of 2026-08. Two anchors, both San Diego:
 *
 *   adu - Snap ADU's published San Diego price table (updated 2026-03) puts
 *   a turnkey detached ADU at $300k-$450k all-in, $375-$600/sqft, with the
 *   "vertical build" line at $220k (500sqft) to $360k (1,200sqft). All-in
 *   includes design and permits, which are out of scope here; vertical build
 *   excludes sitework and utilities, which are in scope. 300k sits between
 *   the two for a typical ~750sqft unit.
 *   https://snapadu.com/adu-costs/
 *
 *   5plus - the San Diego Housing Commission / BAE affordable housing cost
 *   study (2025-04) breaks San Diego LIHTC new construction into $288,833
 *   hard cost per unit against $490,643 total, averaged over application
 *   years 2017-2023. Escalated on the California Construction Cost Index
 *   from that window to 2026 (CCCI 7,018 in 2020 to ~10,153 across Jan-May
 *   2026) that is roughly $370k-$420k, so 400k. LIHTC projects carry
 *   prevailing wage, so this likely runs above a market-rate equivalent.
 *   https://sdhc.org/wp-content/uploads/2025/04/Att-1_Affordable-Housing-Cost-Study-4.17.25.pdf
 *   https://www.dgs.ca.gov/RESD/Resources/Page-Content/Real-Estate-Services-Division-Resources-List-Folder/DGS-California-Construction-Cost-Index-CCCI
 *
 *   duplex and 3_4_unit - INTERPOLATED between those two anchors, not
 *   sourced. No public per-unit dataset covers small market-rate infill at
 *   this scale. They are Type V wood frame like the anchors, with larger
 *   units than an ADU and none of the structured parking or elevators that
 *   drive the 5plus figure, so they land between. Treat as the softest
 *   numbers on this list.
 */
export const HARD_COST_PER_UNIT: Record<Archetype, number> = {
  adu: 300_000,
  duplex: 340_000,
  "3_4_unit": 370_000,
  "5plus": 400_000,
};

export const COST_ASSUMPTIONS = {
  /** One scale for all four sliders, so they can be read against each other. */
  hardCostMin: 150_000,
  hardCostMax: 700_000,
  hardCostStep: 25_000,
} as const;

export const BUDGET = {
  min: 250_000,
  max: 20_000_000,
  step: 250_000,
  default: 2_000_000,
} as const;

/** Whiteboard input is months; the model predicts days. */
export const TIMEFRAME = {
  minMonths: 3,
  maxMonths: 48,
  stepMonths: 1,
  defaultMonths: 18,
} as const;

/** Below this zoom parcels are sub-pixel, so the map draws centroids instead. */
export const DOT_TO_POLYGON_ZOOM = 13;

export const MAP_START = { lng: -117.1611, lat: 32.7157, zoom: 11.2 } as const;

/** Data only exists for the City of San Diego, so zooming out further just
 *  pulls in Orange County / inland desert / Tijuana for no reason. Keeps the
 *  whole city in frame at max zoom-out without pulling in neighbors. */
export const MAP_MIN_ZOOM = 10;

/**
 * Hard pan limit, [[west, south], [east, north]]. parcels.pmtiles's own data
 * bounds (-117.282307,32.534785 to -116.905122,33.114211) padded ~8km so the
 * edge isn't a wall right at the coastline/city limit - not an arbitrary box.
 */
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-117.36, 32.46],
  [-116.83, 33.19],
];

/**
 * When set, the map reads real parcel geometry from a PMTiles archive.
 * When unset it falls back to generated features carrying the identical
 * attribute schema, so filter logic is exercised for real.
 */
export const TILES_URL = import.meta.env.VITE_TILES_URL ?? "";
