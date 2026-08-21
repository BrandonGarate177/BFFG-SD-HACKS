# Building Permits Backend

Backend for the building-permits hackathon project: a fast in-memory search and
detail lookup over **real precomputed ML predictions** (`../data/predictions.parquet`
— 393,755 San Diego parcels, 1,575,020 predictions from a trained
`RandomSurvivalForest`, C-index 0.612 — see `../data/README.md` for the full
pipeline writeup), plus a self-hosted Claude-powered permit Q&A.

No authentication, no cookies — public unauthenticated demo server. `data/` is
read-only from this server's point of view: it's loaded into memory at startup,
never written to.

## Setup

```bash
cd server
python -m venv venv
venv\Scripts\activate        # on macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload
```

The server starts on `http://localhost:8000`. Interactive docs are at
`http://localhost:8000/docs`. Startup loads `../data/predictions.parquet`
(~330 MB in memory, ~1s to load and index) — expect a brief pause before the
server is ready.

## Environment variables

Copy `.env.example` to `.env` and fill in a real key if you have one —
optional; if unset (or if the call fails for any reason), the server falls
back to a realistic mock response with the same shape, so nothing crashes.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key. Powers both `POST /rag/chat` and `/parcel-detail`'s `rag_result` (see `permit_rag.py`). |

```bash
copy .env.example .env
```

There is no `ML_MODEL_URL` — `../data/predictions.parquet` **is** that model's
own precomputed output, so `/parcel-detail` reads it directly instead of making
a live call that would just re-ask the same model for a number it already
computed. The ML bulk-export path (sending parcel data out to an ML team
ingest endpoint) and the separate teammate-hosted RAG bot (Gradio, over
ngrok) have both been retired too — the ngrok tunnel wasn't reliable, and
`permit_rag.py` (Claude + `permit_type_stats.csv`) covers the same ground
self-hosted.

## How it works

### `POST /search` — bulk, precomputed, fast

Filters the real predictions frame in memory (vectorized pandas, no external
calls). `archetype` is required (`adu` | `duplex` | `3_4_unit` | `5plus` —
predictions differ substantially by archetype). `budget_usd` is matched
against `permit_fee_usd` — **a fee floor** (plan check + inspection + two
fixed submittal fees), **not** a full construction-cost estimate; there is no
construction-cost model in this dataset (see `../data/README.md`). Optional
`community` filters by `situs_community`. Results are sorted by fee ascending
and capped at `limit` (default 200, since a wide-open filter can match tens of
thousands of the 393,755 parcels).

### `POST /parcel-detail` — single parcel

Looks up the apn in the real predictions frame (indexed lookup, sub-millisecond),
returning:
- `parcel` — zone, community, ZIP, lot size, coastal-overlay flags, ADU/SB9 eligibility
- `capacity` — by-right unit capacity breakdown (base/ADU/JADU/SB9/bonus)
- `predictions` — all 4 archetypes at once, each with median days to issuance,
  issuance-probability at 180/365 days, permit fee, and DIF applicability
- `model_info` — the model's C-index and the predictions' as-of date, so the
  frontend can (and per `../data/README.md` must) show the model's real
  accuracy alongside any prediction
- `rag_result` — Claude-generated context on the parcel (via `permit_rag.py`),
  or a deterministic mock if `ANTHROPIC_API_KEY` is unset / the call fails

404s on an unknown apn.

### `GET /model-info`

Returns `../data/predictions_meta.json` as-is (C-index, as-of date, row counts).

### `POST /rag/chat` — general permit Q&A

`{"message": "..."}` → `{"answer", "source", "error"}`. Keyword-retrieves the
most relevant rows from `permit_type_stats.csv` (permit type × processing
track → median/avg/p90 days and valuation, from the City's *closed*
approvals), hands them to Claude as grounding context, returns the answer.
Same underlying call `/parcel-detail`'s `rag_result` uses, just answering a
free-form question instead of one built from a specific parcel.

## Files

- `main.py` — FastAPI app: `/search`, `/parcel-detail`, `/model-info`,
  `/rag/chat`, CORS.
- `parcel_lookup.py` — loads `../data/predictions.parquet` +
  `../data/predictions_meta.json` at import time; exposes `get_dataframe()`
  (for `/search`), `get_parcel(apn)`, `get_all_apns()`, `iter_all_parcels()`,
  and `MODEL_INFO`.
- `precomputed_predictions.py` — `filter_parcels(archetype, budget_usd,
  timeframe_months, community=None, limit=200)` over `parcel_lookup`'s frame.
- `rag_client.py` — builds a parcel-specific question, delegates to
  `permit_rag.answer_question`, reshapes the answer into `reasons` /
  `sentiment_summary` for `/parcel-detail`.
- `permit_rag.py` — the actual Claude call + `permit_type_stats.csv`
  retrieval, shared by both RAG-ish endpoints. Mock fallback if
  `ANTHROPIC_API_KEY` is unset or the call fails.
- `permit_type_stats.csv` — the data `permit_rag.py` retrieves from.
- `models.py` — Pydantic request/response models.

## Sample curl commands

### `/search`

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d "{\"archetype\": \"adu\", \"budget_usd\": 20000, \"timeframe_months\": 24}"
```

Tight filter that likely matches nothing:

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d "{\"archetype\": \"5plus\", \"budget_usd\": 100, \"timeframe_months\": 1}"
```

### `/parcel-detail`

Grab a real apn from a `/search` result, then:

```bash
curl -X POST http://localhost:8000/parcel-detail \
  -H "Content-Type: application/json" \
  -d "{\"apn\": \"2671503200\"}"
```

Unknown apn:

```bash
curl -X POST http://localhost:8000/parcel-detail \
  -H "Content-Type: application/json" \
  -d "{\"apn\": \"0000000000\"}"
```

Returns `404`.

### `/rag/chat`

```bash
curl -X POST http://localhost:8000/rag/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"How long does an electrical permit usually take?\"}"
```

### `/model-info`

```bash
curl http://localhost:8000/model-info
```
