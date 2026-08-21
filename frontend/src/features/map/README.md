# Map feature

Owns the home page: parcel geometry, vector tiles, filtering, hover.

**Boundary:** may not import from `features/insights`. Shared vocabulary
lives in `src/shared/`.

## Files

| File | Owns |
|---|---|
| `MapPage.tsx` | layout, filter state, navigation to `/parcel/:apn` |
| `config.ts` | zoom thresholds, slider ranges, cost assumptions, `TILES_URL` |
| `types.ts` | `TileParcel` — mirrors `data/parcels_tile_attributes.parquet` |
| `lib/map.ts` | MapLibre init, PMTiles protocol, the 5-layer stack |
| `lib/filters.ts` | the style expression built from budget + timeframe |
| `lib/cost.ts` | construction-cost calculator, archetype derivation |
| `lib/devParcels.ts` | stand-in geometry until real polygons exist |
| `components/` | `MapCanvas`, `FilterPanel`, `ParcelPopup` |

## Two invariants

**Filters only reach tile attributes.** A MapLibre expression evaluates
against a feature's baked properties. The 18 columns in `types.ts` are the
complete set. Adding a filter on anything else means regenerating
`parcels.pmtiles` in the data pipeline — it is not a frontend change.

**Archetype is derived, never selected.** `archetypeForUnits(delta_units)`
mirrors the training pipeline's assignment rule. This is what makes cost
vary per parcel; a user-picked archetype would give every parcel an
identical cost and the budget slider would stop discriminating spatially.

## Current state

`TILES_URL` is unset, so the map renders generated features from
`lib/devParcels.ts` carrying the exact production schema. A banner says so
on screen. When real geometry lands, set `VITE_TILES_URL` — no other change.

Their APNs are synthetic and will 404 against `/parcel-detail`. Expected.
