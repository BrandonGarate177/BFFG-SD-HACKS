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
| `lib/api.ts` | `/parcel-detail`, `/search`, `/model-info` |
| `components/PredictionPanel.tsx` | all four archetypes, C-index, permit fee |
| `components/CapacityPanel.tsx` | base / ADU / JADU / SB 9 / bonus |
| `components/ParcelFacts.tsx` | zone, lot, ZIP, coastal jurisdiction |
| `components/ParcelFinder.tsx` | apn lookup + `/search`, so this feature demos alone |
| `components/RagPanel.tsx` | markdown answer, provenance, de-duplication |

## Four invariants

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

**`permit_fee_usd` is never relabelled "estimated cost".** It is a fee floor:
building permit only, excluding Development Impact Fees, school fees, and
water/sewer capacity charges, which together often exceed it. There is no
construction-cost model in this dataset. The map's cost figure is a separate,
assumption-based calculator — do not conflate them.

## The RAG response has two shapes

The Gradio client regexes bullet lines OUT of the markdown answer, so
`reasons` is a *subset* of `sentiment_summary` and rendering both prints the
same content twice. The older httpx client returned them as genuinely
separate values. `RagPanel` detects containment rather than assuming either,
because only one of the two is currently pushed.

## Contract drift

`types.ts` is hand-mirrored from `server/models.py`. If the server's
response models change, this file changes in the same PR. The server emits
OpenAPI at `/openapi.json` if you'd rather generate it.
