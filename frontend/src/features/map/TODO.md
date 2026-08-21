# Map — base layer done, several gaps remain

As of 2026-08-21. `[!]` blocks other work.

- [x] **Parcel geometry.** Fetched from the SANDAG regional parcels
  FeatureServer (`https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0`,
  public, no auth, `situs_juris='SD'` filter, `returnCentroid=true`), joined
  to `parcels_tile_attributes.parquet` on `apn` (393,285 of 393,755 matched —
  the 470 misses are jurisdiction-boundary drift, not a join bug). Script:
  `data/scripts/fetch_parcel_geometry.py`.
- [x] **Tile build.** `tippecanoe` installed via brew. `-zg` guessed maxzoom 19
  and produced a 287MB archive — capped to `-z16` instead, which dropped it to
  73MB. `frontend/public/parcels.pmtiles` is committed (in line with the other
  data artifacts already in this repo; still comfortably under GitHub's 100MB
  hard limit).
- [x] **Wire `VITE_TILES_URL`.** Set in `frontend/.env` (gitignored) to
  `/parcels.pmtiles`. The env var alone wasn't enough to actually see
  geometry — two unrelated latent bugs were masked by the geojson dev
  fallback never exercising the real vector-tile path:
  - `maplibre-gl.css` is unlayered, so its `.maplibregl-map { position:
    relative }` beat Tailwind's `@layer utilities` `.absolute` unconditionally
    regardless of import order, collapsing `MapCanvas`'s `inset-0` fill
    container to 0 height. Fixed with an unlayered override in `index.css`.
  - Vite's esbuild dep pre-bundler mishandles `maplibre-gl`'s dedicated worker
    script — the pre-bundled copy 404s, which silently stalls *all*
    vector-tile loading (raster/basemap tiles still work fine since those
    load on the main thread, which is what made this so easy to miss).
    Fixed with `optimizeDeps: { exclude: ["maplibre-gl"] }` in
    `vite.config.ts`; Vite's own dev-server log names this fix directly.
- **Community filter.** Server `/search` accepts `community`; there's no control.
- **Coastal deferred-certification styling.** 2,367 parcels where the Coastal
  Commission permits, not the City. Noted in the popup, not styled on the map.
- **Citywide match count.** Viewport-only today and labelled as such. A real
  total needs precomputed counts from the server.
- **Popup demographics.** Whiteboard calls for value / income / residents. No
  assessed value or ACS data exists in either parquet.
- **Decide `/search`.** The map filters client-side on tile attributes and never
  calls it. Either it backs a list view or it goes.

**Budget semantics (deliberate, not a bug).** This feature filters *estimated
construction cost* — an adjustable assumption. Server `/search` filters
`permit_fee`, which is real and a floor. Two orders of magnitude apart. See
`frontend/CONTRIBUTING.md`.

**Dev parcels carry synthetic APNs**, so clicking through 404s against
`/parcel-detail` when running without `VITE_TILES_URL` set (the geojson
fallback in `lib/devParcels.ts`, still used if `.env` is missing). With real
geometry wired, clicked parcels carry real APNs and should resolve against
`predictions.parquet` normally — not yet spot-checked end to end.
