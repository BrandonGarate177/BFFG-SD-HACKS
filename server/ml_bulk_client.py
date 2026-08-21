import os
from typing import Any

import httpx

ML_MODEL_BULK_URL = os.environ.get("ML_MODEL_BULK_URL")
TIMEOUT_SECONDS = 30.0


def _mock_bulk_response(row_count: int) -> dict[str, Any]:
    """Deterministic mock so the export flow works with zero external services."""
    return {
        "status": "accepted",
        "rows_received": row_count,
    }


async def send_bulk_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Sends the CSV_HEADERS-shaped rows (see csv_export.py) to the ML model's
    bulk-ingest endpoint as a JSON body: {"records": [...]}. No file upload —
    the ML model consumes the data directly. Falls back to a mock response
    (matching the same shape) if the URL is unset or the call fails for any
    reason, so callers never need to handle an error case themselves.
    """
    if not ML_MODEL_BULK_URL:
        return {**_mock_bulk_response(len(records)), "source": "mock", "error": None}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(ML_MODEL_BULK_URL, json={"records": records})
            response.raise_for_status()
            data = response.json()
            return {
                "status": data.get("status", "accepted"),
                "rows_received": data.get("rows_received", len(records)),
                "source": "live",
                "error": None,
            }
    except Exception as exc:
        return {
            **_mock_bulk_response(len(records)),
            "source": "mock",
            "error": f"{type(exc).__name__}: {exc}",
        }
