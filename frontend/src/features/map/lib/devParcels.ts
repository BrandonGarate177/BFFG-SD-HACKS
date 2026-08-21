import type { Feature, FeatureCollection, Point, Polygon } from "geojson";
import type { TileParcel } from "../types";

/**
 * Development stand-in for real parcel geometry.
 *
 * data/parcels_tile_attributes.parquet has all 18 attributes for 393,755
 * parcels but NO geometry - no polygon, no centroid, no lat/lon. Until the
 * SANDAG parcel polygons are joined on `apn` and run through tippecanoe,
 * there is no parcels.pmtiles to point at.
 *
 * These features carry the EXACT same attribute schema, so filter
 * expressions, popups and the detail route are all exercised for real.
 * When the archive lands, set VITE_TILES_URL and the map swaps source
 * without touching anything else.
 */

const ZONES = [
  { zone: "RS-1-7", maxUnits: 1, weight: 46 },
  { zone: "RS-1-1", maxUnits: 1, weight: 8 },
  { zone: "RM-1-1", maxUnits: 3, weight: 16 },
  { zone: "RM-2-5", maxUnits: 6, weight: 10 },
  { zone: "RM-3-7", maxUnits: 12, weight: 6 },
  { zone: "CC-3-5", maxUnits: 20, weight: 5 },
  { zone: "CN-1-3", maxUnits: 0, weight: 5 },
  { zone: "IL-2-1", maxUnits: 0, weight: 4 },
];

const COMMUNITIES = [
  "North Park", "City Heights", "Golden Hill", "Barrio Logan",
  "Clairemont Mesa", "Linda Vista", "Kensington", "Normal Heights",
  "Downtown", "Point Loma", "Mira Mesa", "Southeastern San Diego",
];

/** Deterministic PRNG so the dev map is stable across reloads. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends { weight: number }>(items: T[], r: number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let acc = r * total;
  for (const item of items) {
    acc -= item.weight;
    if (acc <= 0) return item;
  }
  return items[items.length - 1];
}

export type ParcelFeature = Feature<Polygon, TileParcel>;

export function generateDevParcels(count = 4000, seed = 20260821): {
  polygons: FeatureCollection<Polygon, TileParcel>;
  centroids: FeatureCollection<Point, TileParcel>;
} {
  const rand = mulberry32(seed);
  const polygons: ParcelFeature[] = [];
  const centroids: Feature<Point, TileParcel>[] = [];

  // Loose bounding box over the developed part of the city.
  const LNG = [-117.27, -117.02] as const;
  const LAT = [32.66, 32.86] as const;

  for (let i = 0; i < count; i++) {
    const lng = LNG[0] + rand() * (LNG[1] - LNG[0]);
    const lat = LAT[0] + rand() * (LAT[1] - LAT[0]);

    const z = pickWeighted(ZONES, rand());
    const lot_sqft = Math.round(2800 + rand() * 9000);
    const existing_units = z.maxUnits === 0 ? 0 : Math.max(1, Math.round(rand() * Math.min(2, z.maxUnits)));

    // Null in non-residential zones, exactly as the real data behaves.
    const residential = z.maxUnits > 0;
    const capacity = residential ? Math.max(0, z.maxUnits - existing_units) : null;
    const delta_units = residential ? (capacity && capacity > 0 ? capacity : 0) : null;

    // Permit timelines widen with project size, matching the real medians'
    // rough shape (ADUs fastest, 5+ slowest).
    const base = 90 + rand() * 260;
    const pred_days_adu = Math.round(base);
    const pred_days_duplex = Math.round(base * (1.25 + rand() * 0.35));
    const pred_days_3_4_unit = Math.round(base * (1.55 + rand() * 0.45));
    const pred_days_5plus = Math.round(base * (1.95 + rand() * 0.7));

    const prob = (d: number) => Math.max(0.02, Math.min(0.98, 1 - d / 900));

    const props: TileParcel = {
      apn: String(4000000000 + Math.floor(rand() * 999999999)).slice(0, 10),
      zone: z.zone,
      situs_community: rand() < 0.02 ? null : COMMUNITIES[Math.floor(rand() * COMMUNITIES.length)],
      lot_sqft,
      existing_units,
      delta_units,
      adu_eligible: residential && rand() < 0.86,
      sb9_eligible: z.zone.startsWith("RS") && rand() < 0.62,
      in_coastal_overlay: lng < -117.22 && rand() < 0.55,
      coastal_deferred_certification: lng < -117.24 && rand() < 0.08,
      pred_days_adu,
      pred_days_duplex,
      pred_days_3_4_unit,
      pred_days_5plus,
      prob_1yr_adu: prob(pred_days_adu),
      prob_1yr_duplex: prob(pred_days_duplex),
      prob_1yr_3_4_unit: prob(pred_days_3_4_unit),
      prob_1yr_5plus: prob(pred_days_5plus),
    };

    // ~28m square, enough to read as a lot at z15+.
    const d = 0.00013;
    polygons.push({
      type: "Feature",
      id: i,
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lng - d, lat - d], [lng + d, lat - d],
          [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d],
        ]],
      },
      properties: props,
    });

    centroids.push({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: props,
    });
  }

  return {
    polygons: { type: "FeatureCollection", features: polygons },
    centroids: { type: "FeatureCollection", features: centroids },
  };
}
