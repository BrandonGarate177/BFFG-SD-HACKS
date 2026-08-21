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
| `components/HeroAnswer.tsx` | the answer: archetype selector, timing, permit fee |
| `components/ProbabilityStrip.tsx` | nested 180d / 365d issuance bar |
| `components/CapacityPanel.tsx` | the two competing entitlement paths |
| `components/WatchOut.tsx` | every caveat, collected in one place |
| `components/ParcelFacts.tsx` | zone, lot, ZIP, coastal jurisdiction |
| `components/ParcelFinder.tsx` | apn lookup + `/search`, so this feature demos alone |
| `components/ChatRail.tsx` | conversation over `/rag/chat`, context injection |
| `components/SampleDataBanner.tsx` | sticky label for fixture mode |
| `lib/fixture.ts` | sample response, server-unreachable only |

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

## Layout intent

Hero answers the user's question; everything below is evidence. They arrive
from the map having already filtered, so the page opens on the archetype
their parcel's capacity implies — the same rule the map filtered by, so the
number they were looking at is the number they land on.

All four predictions ship in one response, so the archetype selector costs
no refetch. Switching it is the page's main interaction: *what if I built
smaller?*

**Timing is never a bare number.** `ProbabilityStrip` shows P(issued by
180d / 365d) under the median, because a C-index of 0.612 does not support a
confident point estimate. The dataset has no p75/p90 either — 29% censoring
means the survival curves plateau — so horizon probabilities are what the
data actually supports.

**SB 9 competes with the base path, it does not add to it.**
`cap_total = max(cap_base + cap_adu + cap_jadu, cap_sb9)`. `CapacityPanel`
renders both paths with the winner marked; a flat six-row list hides the
relationship. When only one path is known, neither is marked taken.

**Caveats live in one panel, not scattered.** A reader can miss a caveat
sitting beside a figure; `WatchOut` collects all of them so they can't.

## The map's cost assumption arrives by URL

`/parcel/:apn?hardCost=400000`. The map holds four rates, one per archetype,
and sends the single one that applies to the clicked parcel — this page needs
a number, not the table. It is an assumption, not a model output, and the page
shows the resulting construction estimate labelled as the user's own input.
The query param is the interface — the two features still never import each
other. Absent when the parcel has no by-right capacity to price.

## The assistant

`/parcel-detail` already carries one server-composed answer, so the rail
opens with it rather than an empty box. Follow-ups go to `POST /rag/chat`,
which is the same self-hosted Claude + `permit_type_stats.csv` retrieval the
server used to build that opening answer — the conversation is continuous.

**Parcel facts and model numbers are injected into every message**, never
left for the model to recall. It has no access to this parcel otherwise, and
an inferred permit duration is exactly how a wrong number gets spoken aloud.

`reasons` is regexed out of `sentiment_summary` server-side
(`rag_client._parse_chat_response`), so it is a subset — only the full answer
is rendered. Printing both would duplicate every bullet.

## Sample-data fallback

Every panel is gated behind one `/parcel-detail` fetch, so an unreachable
server leaves a blank page. `lib/fixture.ts` fills it, with a sticky
non-dismissible banner and the chat input disabled.

**A 404 does not trigger it.** That means the apn genuinely is not in the
393,755-parcel dataset, and rendering invented numbers under it would imply
the parcel exists. Only an unreachable or erroring server falls back.

## Contract drift

`types.ts` is hand-mirrored from `server/models.py`. If the server's
response models change, this file changes in the same PR. The server emits
OpenAPI at `/openapi.json` if you'd rather generate it.
