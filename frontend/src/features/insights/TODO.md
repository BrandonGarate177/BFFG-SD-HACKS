# Insights — not yet built

As of 2026-08-21. `[!]` blocks other work.

- `[!]` **`RAG_API_URL` unset.** Every RAG response is a mock. It's labelled as
  one in the UI, but nothing is grounded. No AWS endpoint wired.
- `[!]` **pyarrow 19 vs 25.** Both parquets were written by 25.0.1 and won't
  open locally, so the server can't serve real detail. Pin `pyarrow>=25` in
  `server/requirements.txt`.
- **Chat.** Whiteboard says "rag chatbot"; the server returns a one-shot
  `{reasons, sentiment_summary}`. No conversation, no follow-up.
- **Citations.** RAG returns no source references, so answers can't be checked
  on stage. Highest-value addition once the endpoint is live.
- **Prediction context is injected, not retrieved** — confirm the RAG request
  actually carries `predictions` and `capacity` so the bot never infers a
  duration it could get wrong.

**Contract drift.** `types.ts` is hand-mirrored from `server/models.py`. The
server emits OpenAPI at `/openapi.json` if generating it becomes worthwhile.
