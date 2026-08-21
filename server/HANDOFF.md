# Server Handoff

Read this before working on anything that talks to `server/` — especially if
you're building the frontend. Covers what the backend does, its exact API
contract, what's real vs. mocked, how to connect to it, and known gotchas.

## What this is

A FastAPI backend, no database. One process, loads one file into memory at
startup (`../data/predictions.parquet` — 393,755 real San Diego parcels,
1,575,020 predictions from a trained `RandomSurvivalForest`, C-index 0.612),
then serves reads off it. `data/` is read-only from this server's perspective
— never write to it.

Full pipeline writeup: `../data/README.md`. Read that before changing anything
about how predictions are interpreted — it documents what's modeled, what
isn't, and exact wording the UI is required to use (e.g. "by-right capacity",
never "pre-approved").

## Run it

```bash
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # then fill in ANTHROPIC_API_KEY if you have one
uvicorn main:app --reload
```

Startup takes ~1s (Parquet load + index). Server: `http://localhost:8000`.
Interactive docs (try every endpoint from a browser, no curl needed):
`http://localhost:8000/docs`.

## Connecting the frontend

- **Base URL**: `http://localhost:8000` in dev. No path prefix, no versioning.
- **CORS is wide open** (`allow_origins=["*"]` in `main.py`) — call it
  directly from `fetch`/`axios` in the browser, no proxy needed in dev. If
  you deploy this somewhere, lock that down before it's public.
- **No auth** — no headers, no tokens, no cookies. Every request is a plain
  `POST`/`GET` with a JSON body.
- **Every field can be `null`** — the real data has gaps (e.g. `cap_*` fields
  are null for non-residential zones, `coastal_zone` is null outside the
  overlay). Design the UI to handle missing values, don't assume presence.
- **Check `source` on anything RAG-related** (`rag_result.source` on
  `/parcel-detail`, `source` on `/rag/chat`) — it's `"live"` for a real Claude
  answer, `"mock"` if the API key was unset or the call failed. Don't present
  a mock answer as if it were real data-grounded advice.

### Typical frontend flow

1. Filter form → `POST /search` → render the `matches` list (or use it to
   highlight parcels on a map, see "Known gaps" below for why the map itself
   needs a separate geometry source).
2. User clicks/selects one result → `POST /parcel-detail` with that `apn` →
   render the detail panel (zoning, capacity, all 4 archetype predictions,
   `model_info` disclaimer, `rag_result`).
3. Optional standalone chat box → `POST /rag/chat` with free text → render
   `answer` as markdown (Claude's responses use markdown formatting — bold,
   tables, headers).
4. `GET /model-info` once at app load, for a persistent "model accuracy"
   disclosure somewhere in the UI (required per `../data/README.md`).

## Endpoints (5 total)

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/search` | `{archetype, budget_usd, timeframe_months, community?, limit?}` | `{matches: [{apn, archetype, median_days, permit_fee_usd, prob_issued_365d}]}` |
| `POST` | `/parcel-detail` | `{apn}` | see below — 404 on unknown apn |
| `POST` | `/rag/chat` | `{message}` | `{answer, source, error}` — general permit Q&A |
| `GET` | `/model-info` | — | `predictions_meta.json` verbatim (C-index, as-of date, row counts) |
| `GET` | `/health` | — | `{"status": "ok"}` |

`archetype` is one of `adu` / `duplex` / `3_4_unit` / `5plus` — required on
`/search`, predictions differ substantially by type.

**`/search` request fields:**
- `archetype` (required, enum above)
- `budget_usd` (required, float) — matched against `permit_fee_usd`, **a fee
  floor** (plan check + inspection + 2 fixed fees), **not** full construction
  cost. There's no construction-cost model in this dataset at all.
- `timeframe_months` (required, float) — matched against `median_days`
- `community` (optional, string) — exact match against `situs_community`
  (24 distinct values, e.g. `SAN DIEGO`, `LA JOLLA`, `DEL MAR`)
- `limit` (optional, int, default 200) — results are sorted by fee ascending
  and capped here; a wide-open filter can otherwise match tens of thousands

**`/parcel-detail` response shape:**
```
{
  apn: string,
  parcel: {zone, nucleus_use_cd, situs_community, situs_zip, lot_sqft,
           existing_units, coastal_zone, in_coastal_overlay,
           coastal_deferred_certification, adu_eligible, sb9_eligible},
  capacity: {cap_base, cap_adu, cap_jadu, cap_sb9, cap_total, delta_units,
             cap_adu_bonus_max, delta_units_with_bonus},
  predictions: {
    adu:      {median_days, prob_issued_180d, prob_issued_365d, permit_fee_usd, owes_dif},
    duplex:   {...same shape...},
    3_4_unit: {...same shape...},
    5plus:    {...same shape...}
  },
  model_info: {source: "precomputed", model_c_index, predictions_as_of, disclaimer},
  rag_result: {reasons: [string], sentiment_summary, source, error}
}
```

**`/rag/chat` response shape:** `{answer: string (markdown), source, error}`.

## What's real vs. mocked right now

- **Predictions, capacity, search** — 100% real, always. No external call, no
  mock path. Straight from `data/predictions.parquet`.
- **`/rag/chat` and `/parcel-detail`'s `rag_result`** — both live and working,
  self-hosted via `permit_rag.py` (Claude API + keyword retrieval over
  `permit_type_stats.csv`). Both fall back to a mock, same shape, if
  `ANTHROPIC_API_KEY` is unset or the call fails — check `source` to know
  which you got.

There is **no `ML_MODEL_URL`**, no ML bulk-export, and no separate teammate-
hosted RAG bot anymore — all retired. `predictions.parquet` already *is* the
ML model's full precomputed output (calling it live would just re-ask for a
number it already gave us), and the teammate's Gradio RAG bot depended on an
ngrok tunnel that kept going down — replaced with the self-hosted
`permit_rag.py` path, which only needs one API key you control.

## `permit_rag.py` — where the RAG logic came from

Consolidated from the RAG teammate's own project (a one-off zip dump — not in
this repo, it's been deleted; if you get another dump like it, gitignore it
immediately, it'll contain a raw `.env` and possibly a nested `.git/`). Their
project had a lot of scaffolding: a Gradio chat UI, a ChromaDB +
sentence-transformers semantic-search pipeline, a Vercel deploy setup. Buried
in it was `api/chat.py` — already the minimal, UI-free version: keyword
retrieval over a small stats CSV, one Claude call, CORS-enabled, built for
exactly this "proxy it to a frontend" use case. `permit_rag.py` is that logic
adapted to run in-process here:
- `permit_type_stats.csv` (112 rows) — permit type × processing track →
  median/avg/p90 days and valuation, from the City's *closed* approvals only
  (so it won't reflect currently-pending permits running unusually long).
- Keyword-overlap retrieval, not embeddings — deliberately skipped
  `chromadb`/`sentence-transformers` (heavy deps, marginal quality gain at
  this data size).
- One `AsyncAnthropic` call per question, grounded in the retrieved rows.

`rag_client.py` (used by `/parcel-detail`) and the `/rag/chat` route both call
the same `permit_rag.answer_question()` — one underlying integration, two
different questions asked of it (one built from a specific parcel, one
free-form from the user).

## Known gaps (not bugs — the data just doesn't have these)

- **No construction-cost prediction.** `permit_fee_usd` is a fee *floor*, not
  full project cost. Don't relabel it as "estimated cost" anywhere.
- **No address, no geometry.** `predictions.parquet` has no lat/long or
  street address. Those live only in `data/parcels_tile_attributes.parquet`,
  which feeds a separate tippecanoe/pmtiles build for the map's *client-side*
  vector tiles — not wired into this server. If the map needs to highlight
  parcels matching a filter, prefer a MapLibre filter expression against the
  tile layer's own baked-in prediction columns over calling `/search`
  per-interaction — the tile file was built specifically for that.
- **No spatial queries.** `community` on `/search` is an exact string match,
  not a bounding box or polygon. Draw-a-region queries would need geometry
  wired in server-side; not done here.
- **City of San Diego only.** 393,755 of the county's ~1.09M parcels —
  anything outside City zoning jurisdiction isn't covered.

## Files

- `main.py` — routes, CORS, that's it. No business logic lives here.
- `parcel_lookup.py` — loads the Parquet + meta JSON at import time, exposes
  `get_dataframe()` (for `/search`), `get_parcel(apn)`, `get_all_apns()`,
  `iter_all_parcels()`, `MODEL_INFO`. If you need a new field surfaced,
  it's probably a one-line addition to `CONTEXT_COLS` / `CAPACITY_COLS` /
  `PREDICTION_COLS` here plus the matching Pydantic model in `models.py`.
- `precomputed_predictions.py` — `/search`'s filter logic, vectorized pandas
  over `parcel_lookup`'s frame.
- `rag_client.py` — builds a parcel-specific question, delegates to
  `permit_rag.answer_question`, reshapes into `reasons`/`sentiment_summary`.
- `permit_rag.py` — the actual Claude call + `permit_type_stats.csv`
  retrieval, shared by both RAG endpoints. See dedicated section above.
- `permit_type_stats.csv` — the data `permit_rag.py` retrieves from.
- `models.py` — every request/response shape, single source of truth for the
  API contract. `ConfigDict(protected_namespaces=())` is needed on any model
  with a field starting `model_` (Pydantic v2 reserves that prefix) — already
  applied where needed, keep it in mind if you add new `model_*` fields.

## Gotchas worth knowing before you debug them yourself

- **Leftover `uvicorn --reload` / manually-backgrounded processes hold their
  port on Windows** even after you think you killed them — `WinError 10013`
  on startup usually means a stray python.exe is still bound to that port.
  Check with `Get-NetTCPConnection -State Listen | Where LocalPort -eq 8000`
  in PowerShell.
- **`.env` vs `.env.example`** — only `.env` is actually read
  (`load_dotenv()`). Editing `.env.example` does nothing at runtime; it's
  just the template.
- **Pydantic silently drops unrecognized kwargs.** If a response field is
  unexpectedly `null`, check that the dict key being unpacked into the model
  actually matches the model's field name exactly (this bit us once with
  `permit_fee` vs `permit_fee_usd` — see `parcel_lookup.PREDICTION_COLS`).
- **`/rag/chat` responses can take 5–15+ seconds** — it's a real LLM call
  with retrieval first. Design the frontend with a loading state, not a
  blocking spinner that looks broken after 3 seconds.
