import os
from typing import Any

import httpx

ML_MODEL_URL = os.environ.get("ML_MODEL_URL")
TIMEOUT_SECONDS = 10.0


def _mock_prediction(parcel: dict[str, Any]) -> dict[str, Any]:
    """Deterministic, vaguely-plausible mock so demos are stable across runs."""
    units = parcel.get("max_allowed_units", 5) or 5
    lot_size = parcel.get("lot_size_sqft", 5000) or 5000

    predicted_time_months = round(4 + units * 0.4, 1)
    predicted_cost_usd = round(units * 165_000 + lot_size * 45, 2)

    return {
        "predicted_time_months": predicted_time_months,
        "predicted_cost_usd": predicted_cost_usd,
    }


async def get_ml_prediction(parcel: dict[str, Any]) -> dict[str, Any]:
    """
    Calls the external ML model API for a single parcel's refined prediction.
    Falls back to a mock response (matching the same shape) if the URL is
    unset or the call fails for any reason, so callers never need to handle
    an error case themselves.
    """
    if not ML_MODEL_URL:
        return {**_mock_prediction(parcel), "source": "mock", "error": None}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(ML_MODEL_URL, json=parcel)
            response.raise_for_status()
            data = response.json()
            return {
                "predicted_time_months": data["predicted_time_months"],
                "predicted_cost_usd": data["predicted_cost_usd"],
                "source": "live",
                "error": None,
            }
    except Exception as exc:
        return {
            **_mock_prediction(parcel),
            "source": "mock",
            "error": f"{type(exc).__name__}: {exc}",
        }
