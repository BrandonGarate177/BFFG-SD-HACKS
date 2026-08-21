# Building Permits Backend

Backend for the building-permits hackathon project: a fast in-memory search and
detail lookup over **real precomputed ML predictions** (`../data/predictions.parquet`
— 393,755 San Diego parcels, 1,575,020 predictions from a trained
`RandomSurvivalForest`, C-index 0.612 — see `../data/README.md` for the full
pipeline writeup), plus a live call to the teammates' RAG bot for per-parcel
context, and a bulk-export path that hands parcel data to the ML model's
bulk-ingest endpoint.

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

Copy `.env.example` to `.env` and fill in real URLs if you have them. Both are
optional — if unset (or if the call fails for any reason), the server falls
back to a realistic mock response with the same shape, so nothing crashes.

| Variable | Purpose |
|---|---|
| `RAG_API_URL` | Endpoint for the teammates' RAG bot (built on Snowflake). Receives the merged parcel record via POST, returns `{"reasons": [string, ...], "sentiment_summary": string}`. |
| `ML_MODEL_BULK_URL` | Endpoint for the ML model's bulk-ingest. Receives a JSON body `{"records": [...]}`, one object per row, keyed by the DSD projects/approvals column names. No file upload. Returns `{"status": string, "rows_received": number}`. |

```bash
copy .env.example .env
```

There is no `ML_MODEL_URL` — `../data/predictions.parquet` **is** that model's
own precomputed output, so `/parcel-detail` reads it directly instead of making
a live call that would just re-ask the same model for a number it already
computed.

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
- `rag_result` — live if `RAG_API_URL` is set, otherwise a deterministic mock

404s on an unknown apn.

### `GET /model-info`

Returns `../data/predictions_meta.json` as-is (C-index, as-of date, row counts).

### Bulk export to the ML model

- `GET /ml/bulk-export/csv?limit=500` — builds a CSV from up to `limit` parcels
  (default/cap keep this well under the full 393,755-parcel dataset) and
  returns it as a file download, purely for local inspection.
- `POST /ml/bulk-export?limit=500` — builds the same rows and sends them to
  `ML_MODEL_BULK_URL` as a plain JSON POST, `{"records": [...]}` — no file
  upload. Falls back to a mock acknowledgement if the URL is unset or fails.

The row columns follow the DSD projects/approvals schema (`csv_export.py`,
`CSV_HEADERS`) — the exact header list the ML model team specified. The real
parcel data only overlaps a few of those columns (APN as `PROJECT_ID`/`JOB_ID`/
`GIS_APN`, and `delta_units` as `APPROVAL_DU_NET_CHANGE`); the rest are blank —
there's no address, geometry, or project/approval record in this dataset.

## Files

- `main.py` — FastAPI app: `/search`, `/parcel-detail`, `/model-info`,
  `/ml/bulk-export*`, CORS.
- `parcel_lookup.py` — loads `../data/predictions.parquet` +
  `../data/predictions_meta.json` at import time; exposes `get_dataframe()`
  (for `/search`), `get_parcel(apn)`, `get_all_apns()`, `iter_all_parcels()`,
  and `MODEL_INFO`.
- `precomputed_predictions.py` — `filter_parcels(archetype, budget_usd,
  timeframe_months, community=None, limit=200)` over `parcel_lookup`'s frame.
- `rag_client.py` — async `httpx` POST to `RAG_API_URL`, mock fallback.
- `csv_export.py` — DSD-schema CSV/record builder for bulk export.
- `ml_bulk_client.py` — async `httpx` POST to `ML_MODEL_BULK_URL`, mock fallback.
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

### `/model-info`

```bash
curl http://localhost:8000/model-info
```
