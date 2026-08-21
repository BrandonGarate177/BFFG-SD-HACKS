import csv
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, Optional

from anthropic import AsyncAnthropic

# Consolidated from the teammates' Rag_permit/ project — specifically their
# api/chat.py, which was already the minimal, UI-free version of this (built
# for their own Vercel serverless deployment). Dropped: the Gradio UI
# (04_app.py), the ChromaDB/sentence-transformers semantic retrieval path
# (03_query.py) in favor of the same simple keyword retrieval api/chat.py
# used, and the one-time build scripts (01_/02_) — permit_type_stats.csv is
# their finished output, not something this server regenerates.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
STATS_PATH = Path(__file__).parent / "permit_type_stats.csv"
MODEL = "claude-haiku-4-5-20251001"  # faster/cheaper than sonnet; matches the teammate's own update

SYSTEM = (
    "You are an expert assistant for San Diego real estate development, covering permit "
    "processing and affordable housing development underwriting.\n\n"
    "You have TWO knowledge sources:\n"
    "1. RETRIEVED PERMIT STATISTICS (below) from the City of San Diego closed approvals "
    "dataset. Use this for permit timeline and cost questions. Always cite the "
    "APPROVAL_TYPE, PROJECT_PROCESSING_CODE, median days, and valuation where available. "
    "Be clear these are historical medians, not guarantees.\n"
    "2. YOUR OWN KNOWLEDGE for affordable housing topics: LIHTC, QCT/DDA, AMI rent limits, "
    "density bonus, CEQA/NEPA, prevailing wage, QAP scoring, gap financing, deal "
    "feasibility, site due diligence. State clearly when drawing on general expertise vs. "
    "data.\n\n"
    "If a question needs site-specific data you don't have, say so and tell the user where "
    "to find it.\n\n"
    "You may be continuing an earlier conversation — use the prior turns for context (e.g. "
    "'the slowest one' refers back to whatever was discussed before), without re-explaining "
    "things already established.\n\n"
    "IMPORTANT: Reply in plain text only. No markdown — no asterisks, no pound signs, no "
    "dashes for dividers, no bold, no headers. Write in clear paragraphs. Do not add "
    "disclaimers about your knowledge source. Do not say phrases like 'Based on the closed "
    "approvals data', 'Based on the dataset', 'Drawing on my knowledge', or any similar "
    "preamble. Just answer directly.\n\n"
)

_client: Optional[AsyncAnthropic] = None
_rows: Optional[list[dict[str, str]]] = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def _load_rows() -> list[dict[str, str]]:
    global _rows
    if _rows is None:
        with open(STATS_PATH, newline="", encoding="utf-8") as f:
            _rows = list(csv.DictReader(f))
    return _rows


def _fmt_days(x: str) -> str:
    try:
        return f"{float(x):.0f} days"
    except (TypeError, ValueError):
        return "no data"


def _fmt_money(x: str) -> str:
    try:
        v = float(x)
        return f"${v:,.0f}" if v > 0 else "no data"
    except (TypeError, ValueError):
        return "no data"


def _row_to_text(r: dict[str, str]) -> str:
    track = r["PROJECT_PROCESSING_CODE"] or "unspecified"
    text = (
        f"Permit type: {r['APPROVAL_TYPE']}. Processing track: {track}. "
        f"Based on {r['n_permits']} closed approvals: median issuance {_fmt_days(r['median_days_to_issue'])} "
        f"(avg {_fmt_days(r['avg_days_to_issue'])}, 90th pct {_fmt_days(r['p90_days_to_issue'])}). "
    )
    try:
        if float(r["n_with_valuation"]) > 0:
            text += f"Median valuation {_fmt_money(r['median_valuation'])} (avg {_fmt_money(r['avg_valuation'])})."
        else:
            text += "No valuation data."
    except (TypeError, ValueError):
        text += "No valuation data."
    return text


def _retrieve(question: str, rows: list[dict[str, str]], n: int = 6) -> list[dict[str, str]]:
    q = question.lower()
    scored = []
    for r in rows:
        haystack = f"{r['APPROVAL_TYPE'].lower()} {(r['PROJECT_PROCESSING_CODE'] or '').lower()}"
        score = sum(1 for word in q.split() if len(word) > 3 and word in haystack)
        scored.append((score, r))
    scored.sort(key=lambda x: -x[0])
    top = [r for _, r in scored[:n]]
    if not any(score > 0 for score, _ in scored[:n]):
        top = sorted(rows, key=lambda r: float(r["median_days_to_issue"] or 9999))[:n]
    return top


def _mock_answer(question: str) -> str:
    return (
        "Mock answer (ANTHROPIC_API_KEY not set): I don't have a live connection to the "
        f'permit assistant right now, but your question was: "{question}". '
        "Set ANTHROPIC_API_KEY to get a real, data-grounded answer."
    )


def _last_user_message(messages: list[dict[str, str]]) -> str:
    return next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")


def _retrieval_query(messages: list[dict[str, str]]) -> str:
    """Retrieval is grounded in the recent user turns, not just the newest one,
    so a short follow-up ("what about ADUs?") still pulls relevant rows even
    though it doesn't repeat words like "permit" or "days" from earlier turns."""
    user_turns = [m["content"] for m in messages if m["role"] == "user"]
    return " ".join(user_turns[-2:])


async def answer_conversation(messages: list[dict[str, str]]) -> dict[str, Any]:
    """
    Answers the newest user turn in `messages` (the full conversation so far,
    each item {"role": "user"|"assistant", "content": str}, ending on a user
    turn), grounded in permit_type_stats.csv via keyword retrieval, using
    Claude with the full history for follow-up context. Falls back to a mock
    answer if ANTHROPIC_API_KEY is unset or the call fails, so callers never
    need to handle an error case themselves.
    """
    if not ANTHROPIC_API_KEY:
        return {"answer": _mock_answer(_last_user_message(messages)), "source": "mock", "error": None}

    try:
        rows = _load_rows()
        chunks = _retrieve(_retrieval_query(messages), rows)
        context = "\n\n".join(_row_to_text(r) for r in chunks)

        client = _get_client()
        response = await client.messages.create(
            model=MODEL,
            max_tokens=700,
            system=SYSTEM + f"RETRIEVED PERMIT STATISTICS:\n{context}",
            messages=messages,
        )
        return {"answer": response.content[0].text, "source": "live", "error": None}
    except Exception as exc:
        return {
            "answer": _mock_answer(_last_user_message(messages)),
            "source": "mock",
            "error": f"{type(exc).__name__}: {exc}",
        }


async def stream_conversation(messages: list[dict[str, str]]) -> AsyncIterator[dict[str, Any]]:
    """
    Streaming counterpart to answer_conversation, same inputs and same
    grounding. Yields one or more {"type": "chunk", "text": ...} frames as
    the model emits text, then exactly one terminating
    {"type": "done", "source": ..., "error": ...} frame — callers can
    forward each frame to a client verbatim.

    Every path yields at least one chunk before "done", so a caller can
    reassemble the answer by concatenating chunk text without special-casing
    the mock or failure branches.

    `source` is "live" or "mock" as in answer_conversation, plus a third
    value this function alone can produce: "error", when the call failed
    AFTER text was already streamed. A partial answer can't be retracted
    once it's on the wire, so the turn is marked failed rather than being
    silently replaced by the mock the non-streaming path would return.
    """
    if not ANTHROPIC_API_KEY:
        yield {"type": "chunk", "text": _mock_answer(_last_user_message(messages))}
        yield {"type": "done", "source": "mock", "error": None}
        return

    streamed_any = False
    try:
        rows = _load_rows()
        chunks = _retrieve(_retrieval_query(messages), rows)
        context = "\n\n".join(_row_to_text(r) for r in chunks)

        client = _get_client()
        async with client.messages.stream(
            model=MODEL,
            max_tokens=700,
            system=SYSTEM + f"RETRIEVED PERMIT STATISTICS:\n{context}",
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                streamed_any = True
                yield {"type": "chunk", "text": text}
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        if streamed_any:
            yield {"type": "done", "source": "error", "error": error}
        else:
            yield {"type": "chunk", "text": _mock_answer(_last_user_message(messages))}
            yield {"type": "done", "source": "mock", "error": error}
        return

    yield {"type": "done", "source": "live", "error": None}


async def answer_question(question: str) -> dict[str, Any]:
    """Single-shot version, no history — used by POST /rag/chat and rag_client.py."""
    return await answer_conversation([{"role": "user", "content": question}])
