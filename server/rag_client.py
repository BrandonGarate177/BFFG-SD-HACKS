import re
from typing import Any

import permit_rag

# The teammates' Gradio bot (RAG_API_URL, gradio_client) has been retired —
# its ngrok tunnel is dead and out of our control. ANTHROPIC_API_KEY now
# powers this too: we build a parcel-specific question and hand it to the
# same self-hosted Claude + permit_type_stats.csv retrieval that /rag/chat
# uses (permit_rag.answer_question), then reshape the answer into this
# endpoint's reasons/sentiment_summary contract.


def _build_question(parcel: dict[str, Any]) -> str:
    context = parcel.get("parcel", {})
    zone = context.get("zone", "an unknown zone")
    community = context.get("situs_community", "San Diego")
    delta_units = parcel.get("capacity", {}).get("delta_units")
    capacity_note = (
        f" with by-right capacity for about {delta_units} additional units" if delta_units else ""
    )
    return (
        f"I'm evaluating a parcel zoned {zone} in {community}, San Diego{capacity_note}. "
        "What should I know about typical permit timing and cost for a project like this?"
    )


def _parse_chat_response(text: str) -> dict[str, Any]:
    """Claude's answer is free-form markdown, not structured JSON. Pull out
    bullet/numbered lines as discrete reasons; fall back to the whole
    response as a single reason if it isn't list-formatted."""
    bullet_lines = [
        re.sub(r"^\s*([-*]|\d+\.)\s+", "", line).strip()
        for line in text.splitlines()
        if re.match(r"^\s*([-*]|\d+\.)\s+", line)
    ]
    return {
        "reasons": bullet_lines if bullet_lines else [text.strip()],
        "sentiment_summary": text.strip(),
    }


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
    Asks Claude (via permit_rag, grounded in permit_type_stats.csv) for
    context on a parcel. Falls back to a mock response (matching the same
    shape) if ANTHROPIC_API_KEY is unset or the call fails, so callers never
    need to handle an error case themselves.
    """
    question = _build_question(parcel)
    result = await permit_rag.answer_question(question)

    if result["source"] != "live":
        return {**_mock_rag_response(parcel), "source": result["source"], "error": result["error"]}

    return {**_parse_chat_response(result["answer"]), "source": "live", "error": None}
