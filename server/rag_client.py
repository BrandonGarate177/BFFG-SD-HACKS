import os
from typing import Any

import httpx

RAG_API_URL = os.environ.get("RAG_API_URL")
TIMEOUT_SECONDS = 10.0


def _mock_rag_response(parcel: dict[str, Any]) -> dict[str, Any]:
    """Deterministic mock context so the demo works with zero external services."""
    zone = parcel.get("parcel", {}).get("zone", "unknown zoning")
    community = parcel.get("parcel", {}).get("situs_community", "this area")
    delta_units = parcel.get("capacity", {}).get("delta_units")
    units = delta_units if delta_units is not None else "several"

    reasons = [
        f"Parcel is zoned {zone}, with unbuilt by-right capacity for up to {units} units.",
        f"{community} has seen favorable permit turnaround times in recent cycles.",
        "No open code enforcement cases found for this APN in mock records.",
        "Lot dimensions are compatible with standard multi-family site plans.",
    ]

    return {
        "reasons": reasons,
        "sentiment_summary": (
            f"Mock analysis: {community} is generally favorable for development "
            "under current zoning, with no major red flags identified."
        ),
    }


async def get_rag_context(parcel: dict[str, Any]) -> dict[str, Any]:
    """
    Calls the external RAG bot API for a single parcel's reasons/context.
    Falls back to a mock response (matching the same shape) if the URL is
    unset or the call fails for any reason, so callers never need to handle
    an error case themselves.
    """
    if not RAG_API_URL:
        return {**_mock_rag_response(parcel), "source": "mock", "error": None}

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            response = await client.post(RAG_API_URL, json=parcel)
            response.raise_for_status()
            data = response.json()
            return {
                "reasons": data["reasons"],
                "sentiment_summary": data["sentiment_summary"],
                "source": "live",
                "error": None,
            }
    except Exception as exc:
        return {
            **_mock_rag_response(parcel),
            "source": "mock",
            "error": f"{type(exc).__name__}: {exc}",
        }
