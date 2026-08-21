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

`frontend/public/parcels.pmtiles` has real City-of-San-Diego parcel geometry
(fetched from SANDAG, joined to `parcels_tile_attributes.parquet` — see
`TODO.md`), and `frontend/.env` sets `VITE_TILES_URL=/parcels.pmtiles`. If
`.env` is missing, `TILES_URL` is unset and the map falls back to generated
features from `lib/devParcels.ts` carrying the exact production schema, with
a banner saying so on screen — their APNs are synthetic and 404 against
`/parcel-detail`.
