# Insights feature

Owns `/parcel/:apn`: ML permit-timing predictions, by-right capacity
breakdown, and the RAG bot's context.

**Boundary:** may not import from `features/map`. It receives an `apn` from
the route and fetches everything else itself.

## Files

| File | Owns |
|---|---|
| `InsightsPage.tsx` | route, fetch lifecycle, unavailable state |
| `types.ts` | mirrors `server/models.py` response models |
| `lib/api.ts` | `POST /parcel-detail` |
| `components/PredictionPanel.tsx` | all four archetypes, C-index, permit fee |
| `components/CapacityPanel.tsx` | base / ADU / JADU / SB 9 / bonus |
| `components/RagPanel.tsx` | reasons + summary, with provenance |

## Three invariants

**Predictions never render without their accuracy.** `model_info` arrives
with every response. C-index 0.612 against 0.500 for chance — that number
goes on screen next to the prediction, not in a footnote.

**Mock RAG output is labelled as mock.** `rag_result.source` is
`live | mock | error`. When it is not `live`, nothing in that panel is
grounded in a source document, and the UI says so before showing it.

**Nulls are not zeros.** `cap_adu_bonus_max` is null inside the Coastal
Overlay because the 2025 bonus amendments are not confirmed certified by
the Coastal Commission. Null means *indeterminate* — render an em dash,
never `0`.

## Contract drift

`types.ts` is hand-mirrored from `server/models.py`. If the server's
response models change, this file changes in the same PR. The server emits
OpenAPI at `/openapi.json` if you'd rather generate it.
