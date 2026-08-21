import json
from pathlib import Path
from typing import Any, Optional

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data"
PREDICTIONS_PATH = DATA_DIR / "predictions.parquet"
META_PATH = DATA_DIR / "predictions_meta.json"

ARCHETYPES = ["adu", "duplex", "3_4_unit", "5plus"]

# Parcel-level (identical across an apn's 4 archetype rows).
CONTEXT_COLS = [
    "zone",
    "nucleus_use_cd",
    "situs_community",
    "situs_zip",
    "lot_sqft",
    "existing_units",
    "coastal_zone",
    "in_coastal_overlay",
    "coastal_deferred_certification",
    "adu_eligible",
    "sb9_eligible",
]
CAPACITY_COLS = [
    "cap_base",
    "cap_adu",
    "cap_jadu",
    "cap_sb9",
    "cap_total",
    "delta_units",
    "cap_adu_bonus_max",
    "delta_units_with_bonus",
]
# Archetype-level (varies per apn x archetype row).
# Maps source Parquet column -> response key (permit_fee -> permit_fee_usd
# matches models.ArchetypePrediction; a plain column-name loop would silently
# drop the fee since Pydantic ignores unrecognized kwargs).
PREDICTION_COLS = {
    "median_days": "median_days",
    "prob_issued_180d": "prob_issued_180d",
    "prob_issued_365d": "prob_issued_365d",
    "permit_fee": "permit_fee_usd",
    "owes_dif": "owes_dif",
}


def _clean(value: Any) -> Any:
    """Converts pandas/NumPy missing sentinels and blank fixed-width strings to
    None, and NumPy scalars to native Python types, so responses are valid JSON."""
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    if hasattr(value, "item"):
        return value.item()
    return value


_df = pd.read_parquet(PREDICTIONS_PATH)
_df["situs_community"] = _df["situs_community"].str.strip()

# Indexed copy for O(log n) single-apn lookups (/parcel-detail). Kept separate
# from _df (which stays column-oriented for /search's vectorized filtering).
_lookup = _df.set_index(["apn", "archetype"]).sort_index()

with open(META_PATH, encoding="utf-8") as f:
    MODEL_INFO: dict[str, Any] = json.load(f)


def get_dataframe() -> pd.DataFrame:
    """Full predictions frame (one row per apn x archetype), for /search to filter."""
    return _df


def get_parcel(apn: str) -> Optional[dict[str, Any]]:
    """Merged parcel context + capacity + all 4 archetypes' predictions for one apn."""
    try:
        rows = _lookup.loc[apn]
    except KeyError:
        return None

    first = rows.iloc[0]
    context = {col: _clean(first[col]) for col in CONTEXT_COLS}
    capacity = {col: _clean(first[col]) for col in CAPACITY_COLS}
    predictions = {
        archetype: {key: _clean(row[col]) for col, key in PREDICTION_COLS.items()}
        for archetype, row in rows.iterrows()
    }
    return {"apn": apn, "parcel": context, "capacity": capacity, "predictions": predictions}


def get_all_apns() -> list[str]:
    return list(_lookup.index.get_level_values("apn").unique())


def iter_all_parcels():
    """Yields one merged parcel dict per apn. Callers needing a bounded export
    should itertools.islice this rather than materializing all 393,755 parcels."""
    for apn in get_all_apns():
        yield get_parcel(apn)
