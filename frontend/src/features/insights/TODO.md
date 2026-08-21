# Insights — not yet built

As of 2026-08-21. `[!]` blocks other work.

- `[!]` **RAG endpoint is down.** `https://recovery-proclaim-earwig.ngrok-free.dev/`
  returns 502 — their local server, not the tunnel. Every answer is a mock and
  labelled as one. Check `rag_result.source` before trusting anything in a demo.
- `[!]` **Server can't read its own data.** `requirements.txt` pins
  `pyarrow==17.0.0`, which has no Python 3.13 wheel and cannot read these
  parquets anyway — they were written by 25.0.1, and older readers fail with
  `Repetition level histogram size mismatch`. Verified 25.0.1 reads all
  1,575,020 rows. Pin `pyarrow>=25`.
- **Gradio `rag_client.py` isn't pushed.** No branch contains it; `origin/main`
  still has the httpx version. The UI handles both response shapes.
- **Chat.** The assistant answers one server-composed question per parcel. No
  conversation, no user-typed follow-up.
- **Citations.** Gradio returns prose with no source references, so answers
  can't be checked. Highest-value addition once the endpoint is live.
- **Prediction context injection.** Confirm the question the server composes
  actually carries `predictions` and `capacity`, so the bot never infers a
  duration it could get wrong.
- **Community list.** `situs_community` has 24 exact-match values; the finder
  takes free text. `/meta` or a constant would make it a select.

**Contract drift.** `types.ts` is hand-mirrored from `server/models.py`. The
server emits OpenAPI at `/openapi.json` if generating it becomes worthwhile.

**Not verified in a browser.** Build, typecheck and boundary checks pass; the
dedupe logic is unit-checked against both RAG shapes. Nobody has loaded the page.
