import type { Archetype } from "../../shared/domain/archetype";

/**
 * Hand-mirrored from server/models.py. If the server's response models
 * change, this file changes in the same PR.
 *
 * Every field can be null — the real data has gaps (cap_* is null in
 * non-residential zones, ~15.4% of parcels). Never assume presence.
 */

export type ArchetypePrediction = {
  median_days: number | null;
  prob_issued_180d: number | null;
  prob_issued_365d: number | null;
  /**
   * Building permit only — plan check, inspection, two fixed submittal fees.
   * A FLOOR, not project cost. There is no construction-cost model in this
   * dataset. Never relabel this as "estimated cost".
   */
  permit_fee_usd: number | null;
  owes_dif: boolean | null;
};

export type ParcelCapacity = {
  cap_base: number | null;
  cap_adu: number | null;
  cap_jadu: number | null;
  cap_sb9: number | null;
  cap_total: number | null;
  delta_units: number | null;
  cap_adu_bonus_max: number | null;
  delta_units_with_bonus: number | null;
};

export type ParcelContext = {
  zone: string | null;
  nucleus_use_cd: string | null;
  /** 24 distinct values, uppercase jurisdiction names (SAN DIEGO, LA JOLLA). */
  situs_community: string | null;
  situs_zip: string | null;
  lot_sqft: number | null;
  existing_units: number | null;
  /** CST-APP | N-APP-1 | N-APP-2 | CST-PMT | DEF-CER | CSTZB | null */
  coastal_zone: string | null;
  in_coastal_overlay: boolean | null;
  coastal_deferred_certification: boolean | null;
  adu_eligible: boolean | null;
  sb9_eligible: boolean | null;
};

export type ModelInfo = {
  source: string;
  model_c_index: number;
  predictions_as_of: string;
  disclaimer: string;
};

/** GET /model-info — predictions_meta.json verbatim. */
export type ModelMeta = {
  generated_at: string;
  as_of_date: string;
  parcels: number;
  archetypes: Archetype[];
  rows: number;
  model_c_index: number;
  model_trained_at: string;
};

export type RagSource = "live" | "mock" | "error";

export type RagResult = {
  /**
   * With the Gradio client these are bullet/numbered lines regexed OUT of
   * the markdown answer, so they are a SUBSET of sentiment_summary — the
   * UI must not render both verbatim. See RagPanel.
   */
  reasons: string[];
  /** Full markdown chat answer from the Gradio ChatInterface. */
  sentiment_summary: string;
  source: RagSource;
  error?: string | null;
};

export type ParcelDetail = {
  apn: string;
  parcel: ParcelContext;
  capacity: ParcelCapacity;
  /** All four archetypes arrive at once. */
  predictions: Record<Archetype, ArchetypePrediction>;
  model_info: ModelInfo;
  rag_result: RagResult;
};

/** POST /search */
export type SearchRequest = {
  archetype: Archetype;
  /** Matched against permit_fee_usd — a fee floor, not project cost. */
  budget_usd: number;
  timeframe_months: number;
  community?: string;
  limit?: number;
};

export type ParcelMatch = {
  apn: string;
  archetype: Archetype;
  median_days: number;
  permit_fee_usd: number;
  prob_issued_365d: number | null;
};

export type SearchResponse = { matches: ParcelMatch[] };
