# Map — not yet built

As of 2026-08-21. `[!]` blocks other work.

- `[!]` **Parcel geometry.** `parcels_tile_attributes.parquet` has 18 attributes
  for 393,755 parcels and no geometry. Needs SANDAG polygons joined on `apn`,
  exported as polygons + centroids.
- `[!]` **Tile build.** `tippecanoe` not installed (`brew install tippecanoe`).
  No `parcels.pmtiles` yet, so the map runs on `lib/devParcels.ts`.
- **Wire `VITE_TILES_URL`** once the archive exists. One env var, no code change.
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
`/parcel-detail`. Expected until geometry lands.
