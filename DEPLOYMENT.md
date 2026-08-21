# Deployment

Measured on 2026-08-21 against `main`. Numbers below are real, not estimates.

## What we're shipping

| Piece | Size | Shape |
|---|---|---|
| Frontend JS/CSS | **1.4 MB** | static, cacheable forever |
| `parcels.pmtiles` | **73 MB** | static, served by HTTP range requests |
| FastAPI server | — | one stateless process, holds data in RAM |
| `predictions.parquet` | 15 MB on disk | **~554 MB resident** once queried |
| `permit_type_stats.csv` | 12 KB | read at import |

Nothing writes. No database, no sessions, no user accounts. That makes this
much easier than it looks — but two numbers dictate every choice below.

---

## The two constraints that decide everything

### 1. Memory: ~554 MB, not the 330 MB the README claims

```
at rest, after startup     92 MB
after 3 API requests      554 MB
```

`/search` filters the full 1,575,020-row frame with vectorized pandas, which
materializes intermediates. It settles around half a gig.

**This rules out every 512 MB tier.** Render free and Render Starter are both
512 MB — the process will OOM on the second search. **Budget 1 GB minimum, 2 GB
to be comfortable.**

### 2. Startup: ~14 seconds to load the parquet

**This rules out serverless.** Vercel Functions, Netlify Functions and Lambda
would pay that cost on every cold start, and a 15 MB data file plus pandas and
pyarrow is near the bundle ceiling anyway.

Google Cloud Run works *only* with `--min-instances=1`, which means you're
paying for an always-on instance — at which point a plain VM is simpler.

### Also: `/ws/rag/chat` is a WebSocket

Rules out anything that only speaks request/response. Render, Railway, Fly and
Cloud Run all support WS; most edge-function platforms don't.

---

## Recommended shape

Three pieces, deployed independently. The tiles are split out deliberately —
see the file-size trap below.

```
   Static host          Object storage           Container host
  ┌───────────┐        ┌──────────────┐        ┌───────────────┐
  │ frontend  │        │ parcels      │        │ FastAPI       │
  │ 1.4 MB    │───────▶│ .pmtiles     │        │ 1 GB RAM      │
  │           │        │ 73 MB        │        │ + parquet     │
  │           │───────────────────────────────▶│ + WS          │
  └───────────┘        └──────────────┘        └───────────────┘
   Cloudflare Pages     Cloudflare R2 / S3       Fly.io / Railway
```

### The file-size trap

**Cloudflare Pages rejects files over 25 MiB.** Our tile archive is 73 MB, so a
naive `pages deploy ./dist` fails. Netlify and Vercel have their own per-file
and total-deployment ceilings.

Put the tiles in **object storage** instead — R2 or S3. Both support range
requests natively, which is exactly what PMTiles needs, and R2 has no egress
fee. Then point the app at it:

```bash
VITE_TILES_URL=https://<bucket>.r2.dev/parcels.pmtiles
```

The bucket needs CORS allowing your frontend origin, and `Accept-Ranges: bytes`
(both R2 and S3 do this by default).

This also fixes a live bug — see "Blockers" below.

### Server host

| Host | RAM | WS | Notes |
|---|---|---|---|
| **Fly.io** | set to 1 GB | yes | `fly launch`, one `fly.toml`. Scales to zero if you accept the 14s wake. |
| **Railway** | usage-based | yes | Easiest path. Reads the Dockerfile, sets env vars in the UI. |
| Render | needs Standard (2 GB) | yes | Free and Starter are 512 MB — **will OOM**. |
| Cloud Run | up to 32 GB | yes | Only viable with `--min-instances=1`. |

Any of these is fine. Railway is the least ceremony; Fly is the cheapest at 1 GB.

---

## Blockers to clear before deploying

### 1. `frontend/.env` is gitignored, so tiles silently don't load

`config.ts` reads `VITE_TILES_URL` and falls back to `""`, which switches the
map to generated parcels from `lib/devParcels.ts`. On a fresh clone or a CI
build there is no `.env`, so **the 73 MB archive ships and is never read** — the
map quietly renders fake parcels with synthetic APNs that 404 on click.

Vite inlines env vars at **build** time, so this must be set in the build
environment, not at runtime.

- Set `VITE_TILES_URL` in the host's build settings, **and**
- Default it in `features/map/config.ts` so a missing value can't fail silently

### 2. `pyarrow==17.0.0` in `requirements.txt` cannot install or read the data

No cp313 wheel — it builds from source and fails on Python 3.13. And the
parquets were written by pyarrow 25.0.1; older readers fail with
`Repetition level histogram size mismatch`. **A clean container build will not
start.** Needs `pyarrow>=25`.

### 3. CORS is `allow_origins=["*"]`

Fine for localhost. Once deployed, set it to the frontend origin — the server
holds an Anthropic key and `/rag/chat` is unauthenticated, so an open CORS
policy means anyone can spend your tokens from their own page.

### 4. `ANTHROPIC_API_KEY` must come from the host's secret store

Never in the image, never in git. `server/.env` is gitignored — keep it that
way and use the platform's env var UI.

### 5. Rate limiting: there is none

`/rag/chat` and `/ws/rag/chat` call Claude with no auth and no throttle. A
public URL plus a loop is an unbounded bill. Before sharing the link publicly,
add a simple per-IP limit or keep the deployment unlisted.

---

## Data: ship it in the image

`predictions.parquet` is 15 MB. Copy it into the container rather than fetching
at boot — simpler, and it removes a startup dependency. `data/` is read-only
from the server's perspective, so there is nothing to persist and no volume to
mount.

The repo is already carrying it: `.git` is **101 MB**, mostly the tiles and
parquets. Clone times will be slow but it works. If that becomes painful, move
the tiles to object storage and drop them from git — the object-storage split
above makes that a one-line change.

---

## Server memory, if 1 GB proves tight

`/parcel-detail` only needs a per-APN lookup; the full frame exists solely for
`/search`'s vectorized filter. Precomputing a per-APN store (SQLite or a keyed
JSON) would cut resident memory by roughly an order of magnitude and drop
startup to near zero.

That is an optimization, not a prerequisite — noted here so it isn't
rediscovered under pressure.

---

## Deploy order

1. Fix the three blockers above (pyarrow pin, `VITE_TILES_URL` default, CORS)
2. Upload `parcels.pmtiles` to R2/S3, enable CORS for the frontend origin
3. Deploy the server with 1 GB RAM and `ANTHROPIC_API_KEY` set; confirm
   `/health` and one `/parcel-detail` for apn `2671503200`
4. Build the frontend with `VITE_API_BASE` and `VITE_TILES_URL` pointing at the
   two live URLs
5. Deploy the static build
6. Tighten CORS to the real frontend origin and redeploy the server

## Smoke test after deploying

```bash
curl $API/health
curl -X POST $API/parcel-detail -H 'Content-Type: application/json' \
  -d '{"apn":"2671503200"}' | head -c 200
curl -X POST $API/rag/chat -H 'Content-Type: application/json' \
  -d '{"message":"How long does a building permit take?"}'   # expect source: "live"
curl -I -H 'Range: bytes=0-1023' $TILES_URL                  # expect 206 + Accept-Ranges
```

Then load a parcel page and confirm the RAG panel does **not** say `mock`.
