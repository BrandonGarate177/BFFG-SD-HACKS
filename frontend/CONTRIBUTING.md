# Frontend — contributor rules

Read this before adding a file. The boundaries below are enforced by
`npm run check:boundaries`, which runs as part of `npm run build`.

## Layout

```
src/
  app/          shell only — router. The ONLY module that may see both features.
  features/
    map/        the map page: geometry, tiles, filters, hover
    insights/   the parcel dashboard: ML predictions, capacity, RAG bot
  shared/       used by BOTH, owned by NEITHER
```

## The three rules

**1. Features never import each other.**
`features/map` and `features/insights` are independent slices. They
communicate only through the URL — the map navigates to `/parcel/:apn`, and
Insights reads the apn from the route. If you find yourself wanting to
import across, the thing you want belongs in `shared/`.

**2. `shared/` never imports a feature.**
It is the leaf of the dependency graph, not the trunk. If something in
`shared/` needs a feature's type, it is not shared — move it back.

**3. Outside callers stop at the barrel.**
Each feature exposes `index.ts`. From outside, import
`from "../features/map"`, never `from "../features/map/lib/filters"`.
Inside a feature, import its own internals freely.

## Who owns what

| Concern | Owner | Notes |
|---|---|---|
| Parcel geometry, tiles, PMTiles | `features/map/lib/map.ts` | |
| Filter expressions | `features/map/lib/filters.ts` | tile attributes only |
| Construction-cost calculator | `features/map/lib/cost.ts` | an assumption, not a model |
| Tile attribute schema | `features/map/types.ts` | mirrors `parcels_tile_attributes.parquet` |
| `/parcel-detail` contract | `features/insights/types.ts` | mirrors `server/models.py` |
| ML prediction display | `features/insights/components/PredictionPanel.tsx` | |
| RAG display | `features/insights/components/RagPanel.tsx` | |
| `Archetype` vocabulary | `shared/domain/archetype.ts` | both features need it |
| HTTP transport | `shared/api/client.ts` | features own their own endpoints |
| Formatters | `shared/format.ts` | |

**Adding a filter?** It needs a matching attribute baked into the tiles.
That is a change to the data pipeline, not the frontend. See the tile
attribute list in `features/map/types.ts`.

**Adding a field to the parcel dashboard?** It comes from `/parcel-detail`.
That is a change to `server/models.py`, mirrored in
`features/insights/types.ts`.

## Two things that are not the same number

`budget` means different things on each side, deliberately:

- **Map** filters on *estimated construction cost* — `delta_units ×
  hardCostPerUnit[archetype]`, an adjustable assumption. The rate is per
  archetype, so a parcel is priced at its own project size. The dataset does
  not model construction cost; provenance for the four rates is in
  `features/map/config.ts`.
- **Server `/search`** filters on `permit_fee` — real, from the fee schedule,
  and a *floor* (building permit only).

They differ by roughly two orders of magnitude. Never wire one slider to
both. Label them distinctly wherever they appear.

## Language rules

**Say "by-right capacity". Never "pre-approved."** Zoning is a standing
permission — no discretionary review is *needed*. No approval event has
happened for any specific project on any of these parcels. A planner reads
"pre-approved" as a factual error and discounts everything after it.

**Never show a prediction without its accuracy.** Model C-index is 0.612
against 0.500 for chance. `ModelInfo` ships with every `/parcel-detail`
response for exactly this reason.

**`delta_units` is a screening estimate.** It ignores FAR, height, setbacks
and parking. Real capacity is generally lower. Say so near the number.

## Commands

```bash
npm run dev               # localhost:5173
npm run check:boundaries  # feature-boundary check
npm run build             # boundaries + typecheck + build
```
