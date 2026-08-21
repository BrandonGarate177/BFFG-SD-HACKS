import json
from pathlib import Path
from typing import Any

from models import ParcelMatch

PREDICTIONS_PATH = Path(__file__).parent / "sample_precomputed_predictions.json"

_predictions: dict[str, dict[str, Any]] = {}


def _load() -> None:
    with open(PREDICTIONS_PATH, encoding="utf-8") as f:
        _predictions.update(json.load(f))


_load()


def get_prediction(parcel_id: str) -> dict[str, Any] | None:
    return _predictions.get(parcel_id)


def filter_parcels(budget_usd: float, timeframe_months: float) -> list[ParcelMatch]:
    matches = []
    for parcel_id, prediction in _predictions.items():
        if (
            prediction["predicted_cost_usd"] <= budget_usd
            and prediction["predicted_time_months"] <= timeframe_months
        ):
            matches.append(
                ParcelMatch(
                    parcel_id=parcel_id,
                    predicted_time_months=prediction["predicted_time_months"],
                    predicted_cost_usd=prediction["predicted_cost_usd"],
                )
            )

    matches.sort(key=lambda m: m.predicted_cost_usd)
    return matches
