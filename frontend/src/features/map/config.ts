/**
 * Map-feature constants. Nothing outside features/map imports this.
 *
 * The cost figures are ASSUMPTIONS, not model output. The permit dataset
 * does not model construction cost at all (data/README.md: "Construction
 * cost is not modelled at all - out of scope by design"). The server's
 * /search matches budget against `permit_fee`, which is a fee floor and a
 * different quantity entirely. So the map's budget filter is a CALCULATOR
 * with a visible, adjustable input - never presented as a prediction.
 */
export const COST_ASSUMPTIONS = {
  /** Turnkey construction cost per dwelling unit, USD. User-adjustable. */
  hardCostPerUnit: 350_000,
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
