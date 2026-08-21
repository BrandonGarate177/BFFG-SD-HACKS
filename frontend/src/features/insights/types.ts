import type { Archetype } from "../../shared/domain/archetype";

/** Mirrors server/models.py. Private to the Insights feature. */

export type ArchetypePrediction = {
  median_days: number | null;
  prob_issued_180d: number | null;
  prob_issued_365d: number | null;
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

export type ModelInfo = {
  source: string;
  model_c_index: number;
  predictions_as_of: string;
  disclaimer: string;
};

export type RagResult = {
  reasons: string[];
  sentiment_summary: string;
  source: "live" | "mock" | "error";
  error?: string | null;
};

export type ParcelDetail = {
  apn: string;
  parcel: Record<string, unknown>;
  capacity: ParcelCapacity;
  /** All four archetypes arrive at once. */
  predictions: Record<Archetype, ArchetypePrediction>;
  model_info: ModelInfo;
  rag_result: RagResult;
};
