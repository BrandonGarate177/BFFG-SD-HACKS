import type { Archetype } from "../../shared/domain/archetype";

/**
 * Mirrors data/parcels_tile_attributes.parquet exactly - 18 columns,
 * 393,755 City of San Diego parcels.
 *
 * These are the ONLY fields a MapLibre filter expression can reach, because
 * they are the only ones baked into the tiles. Filtering on anything not
 * listed here means regenerating parcels.pmtiles, not shipping a frontend
 * change.
 *
 * Feature-local on purpose: the Insights feature never sees tile
 * attributes, it reads the richer /parcel-detail payload instead.
 */
export type TileParcel = {
  apn: string;
  zone: string;
  /** ~2% null in the source data. */
  situs_community: string | null;
  lot_sqft: number;
  existing_units: number;
  /** Unbuilt by-right capacity. NULL in non-residential zones (15.4%). */
  delta_units: number | null;
  adu_eligible: boolean;
  sb9_eligible: boolean;
  in_coastal_overlay: boolean;
  /** No certified Local Coastal Program - the Coastal Commission permits, not the City. */
  coastal_deferred_certification: boolean;
  pred_days_adu: number;
  pred_days_duplex: number;
  pred_days_3_4_unit: number;
  pred_days_5plus: number;
  prob_1yr_adu: number;
  prob_1yr_duplex: number;
  prob_1yr_3_4_unit: number;
  prob_1yr_5plus: number;
};

export const PRED_DAYS_FIELD: Record<Archetype, keyof TileParcel> = {
  adu: "pred_days_adu",
  duplex: "pred_days_duplex",
  "3_4_unit": "pred_days_3_4_unit",
  "5plus": "pred_days_5plus",
};

export const PROB_1YR_FIELD: Record<Archetype, keyof TileParcel> = {
  adu: "prob_1yr_adu",
  duplex: "prob_1yr_duplex",
  "3_4_unit": "prob_1yr_3_4_unit",
  "5plus": "prob_1yr_5plus",
};
