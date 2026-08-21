import type { ParcelDetail } from "../types";

/**
 * Sample response, used ONLY when the server is unreachable.
 *
 * The panels are otherwise entirely gated behind one /parcel-detail fetch,
 * so a server that is down or mid-restart leaves nothing on screen. That
 * blocks UI work and turns a demo hiccup into a blank page.
 *
 * Shaped to exercise the interesting branches: SB 9 beats the stacked path,
 * the parcel sits in the Coastal Overlay, and DIF applies on the larger
 * archetypes. Values are plausible but INVENTED — every consumer must render
 * the sample banner. See SampleDataBanner.
 */
export const SAMPLE_PARCEL_DETAIL: ParcelDetail = {
  apn: "0000000000",
  parcel: {
    zone: "RS-1-7",
    nucleus_use_cd: "SFR",
    situs_community: "SAN DIEGO",
    situs_zip: "92104",
    lot_sqft: 6200,
    existing_units: 1,
    coastal_zone: null,
    in_coastal_overlay: false,
    coastal_deferred_certification: false,
    adu_eligible: true,
    sb9_eligible: true,
  },
  capacity: {
    cap_base: 1,
    cap_adu: 1,
    cap_jadu: 1,
    cap_sb9: 4,
    cap_total: 4,
    delta_units: 3,
    cap_adu_bonus_max: null,
    delta_units_with_bonus: null,
  },
  predictions: {
    adu: {
      median_days: 187,
      prob_issued_180d: 0.48,
      prob_issued_365d: 0.79,
      permit_fee_usd: 3140,
      owes_dif: false,
    },
    duplex: {
      median_days: 264,
      prob_issued_180d: 0.31,
      prob_issued_365d: 0.66,
      permit_fee_usd: 5980,
      owes_dif: true,
    },
    "3_4_unit": {
      median_days: 318,
      prob_issued_180d: 0.24,
      prob_issued_365d: 0.58,
      permit_fee_usd: 8420,
      owes_dif: true,
    },
    "5plus": {
      median_days: 402,
      prob_issued_180d: 0.16,
      prob_issued_365d: 0.44,
      permit_fee_usd: 14300,
      owes_dif: true,
    },
  },
  model_info: {
    source: "sample",
    model_c_index: 0.612,
    predictions_as_of: "2026-08-20",
    disclaimer:
      "Ranks parcels better than chance (C-index above), not a commitment. Based on historical permits, not a forecast.",
  },
  rag_result: {
    reasons: [],
    sentiment_summary:
      "Sample answer. The assistant is unavailable because the server could not be reached, so nothing here is retrieved from the permit statistics.",
    source: "mock",
    error: null,
  },
};
