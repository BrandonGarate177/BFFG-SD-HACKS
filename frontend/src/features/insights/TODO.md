# Insights — not yet built

As of 2026-08-21. `[!]` blocks other work.

- `[!]` **Server can't read its own data.** `requirements.txt` pins
  `pyarrow==17.0.0`, which has no Python 3.13 wheel and cannot read these
  parquets anyway — they were written by 25.0.1, and older readers fail with
  `Repetition level histogram size mismatch`. Verified 25.0.1 reads all
  1,575,020 rows. Pin `pyarrow>=25`.
- **`ANTHROPIC_API_KEY` must be set** or every answer is a labelled mock.
- **Citations.** The assistant answers in prose with no source references, so
  claims can't be checked against `permit_type_stats.csv`. Highest-value
  remaining addition.
- **No streaming.** `/rag/chat` returns a complete answer, so there is a
  multi-second silent gap. There's a thinking state; streaming would be better.
- **Conversation is not sent.** Each question goes alone with injected parcel
  context — the server takes a single `message`, so the model cannot see
  earlier turns. Follow-ups like "what about the other one?" will not resolve.
- **Community list.** `situs_community` has 24 exact-match values; the finder
  takes free text. `/meta` or a constant would make it a select.

**Contract drift.** `types.ts` is hand-mirrored from `server/models.py`. The
server emits OpenAPI at `/openapi.json` if generating it becomes worthwhile.

**Not verified in a browser.** Build, typecheck and boundary checks pass; the
dedupe logic is unit-checked against both RAG shapes. Nobody has loaded the page.
