# Building Permits Backend

Two-stage backend for the building-permits hackathon project: a fast in-memory
search over precomputed predictions, and a live per-parcel detail lookup that
calls two external APIs (ML model + RAG bot) in parallel.

No authentication, no cookies — public unauthenticated demo server. Runs
end-to-end out of the box with zero configuration, using the bundled sample
data and mock fallbacks.

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
`http://localhost:8000/docs`.

## Environment variables

Copy `.env.example` to `.env` and fill in real URLs if you have them. Both
are optional — if unset (or if the call fails for any reason), the server
falls back to a realistic mock response with the same shape, so `/parcel-detail`
never crashes.

| Variable        | Purpose                                                                                     |
|------------------|-----------------------------------------------------------------------------------------------|
| `ML_MODEL_URL`   | Endpoint for the ML model API. Receives one parcel's attributes via POST, returns `{"predicted_time_months": number, "predicted_cost_usd": number}`. Refines/re-confirms the precomputed prediction for a single parcel. |
| `RAG_API_URL`    | Endpoint for the teammates' RAG bot (built on Snowflake). Receives one parcel's attributes via POST, returns `{"reasons": [string, ...], "sentiment_summary": string}`. |

```bash
copy .env.example .env
```

## How it works

### Stage 1 — `POST /search` (bulk, precomputed, fast)

Filters `sample_precomputed_predictions.json` in memory — no external calls.
Every parcel in that file already has a `predicted_time_months` and
`predicted_cost_usd` (as if generated ahead of time by the ML model).
Returns every parcel whose predicted cost is within `budget_usd` and whose
predicted time is within `timeframe_months`, sorted by cost ascending.

### Stage 2 — `POST /parcel-detail` (single parcel, live)

Looks up the clicked parcel's full attributes from `sample_parcels.geojson`,
then calls the ML model API and the RAG bot API **concurrently**
(`asyncio.gather(..., return_exceptions=True)`). If either call fails or its
URL is unset, that result falls back to a mock — the other real result is
still returned. Nothing ever crashes the endpoint.

## Files

- `main.py` — FastAPI app, `/search` and `/parcel-detail` routes, CORS.
- `parcel_lookup.py` — loads `sample_parcels.geojson`, exposes
  `get_all_parcels()` / `get_parcel_by_id(id)`.
- `precomputed_predictions.py` — loads
  `sample_precomputed_predictions.json` at startup, exposes
  `filter_parcels(budget_usd, timeframe_months)`.
- `ml_model_client.py` — async `httpx` POST to `ML_MODEL_URL`, mock fallback.
- `rag_client.py` — async `httpx` POST to `RAG_API_URL`, mock fallback.
- `models.py` — Pydantic request/response models.
- `sample_parcels.geojson` — 10 fake San Diego parcels (near 32.71, -117.16).
- `sample_precomputed_predictions.json` — matching fake predictions with a
  spread of time/cost values, for testing filters.

## Sample data

10 fake parcels, `SD-0001`..`SD-0010`, with predicted costs ranging from
$420,000 to $19,000,000 and predicted times from 5 to 34 months — enough
spread to exercise budget/timeframe filtering.

## Sample curl commands

### `/search`

Budget/timeframe that matches a handful of the smaller parcels:

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d "{\"budget_usd\": 2000000, \"timeframe_months\": 15}"
```

Expected: `SD-0002`, `SD-0004`, `SD-0006`, `SD-0009` (each has
`predicted_cost_usd <= 2,000,000` and `predicted_time_months <= 15`).

Wide-open budget/timeframe that matches everything:

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d "{\"budget_usd\": 20000000, \"timeframe_months\": 40}"
```

Tight budget that matches nothing:

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d "{\"budget_usd\": 100000, \"timeframe_months\": 3}"
```

### `/parcel-detail`

Click into one of the parcels returned by `/search`:

```bash
curl -X POST http://localhost:8000/parcel-detail \
  -H "Content-Type: application/json" \
  -d "{\"parcel_id\": \"SD-0002\"}"
```

With no `ML_MODEL_URL` / `RAG_API_URL` set, this returns the parcel's full
attributes plus mock `ml_result` and `rag_result` (each tagged
`"source": "mock"`). Once you point the env vars at real teammate services,
the same call returns live results (tagged `"source": "live"`), and if one
service is down the other's result still comes through with the failing one
marked `"source": "mock"` (or `"error"` if even the mock path throws) and an
`error` message describing what happened.

Unknown parcel:

```bash
curl -X POST http://localhost:8000/parcel-detail \
  -H "Content-Type: application/json" \
  -d "{\"parcel_id\": \"SD-9999\"}"
```

Returns `404`.
