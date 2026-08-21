# Frontend Spec: Streaming Chat via WebSocket

## What the server now does

The WebSocket at `ws://<host>/ws/rag/chat` now streams responses instead of sending one blob. For each user message it sends a sequence of JSON frames:

```json
// 1..N chunk frames (text delta, arrives incrementally)
{ "type": "chunk", "text": "San Diego typically..." }

// 1 done frame (signals end of response)
{ "type": "done", "source": "live", "error": null }

// Keepalive (ignore these)
{ "type": "ping" }
```

The `source` on `done` is `"live"` | `"mock"`. `error` is a string or `null`.

The existing message shape the client sends is **unchanged**:
```json
{ "message": "Why does this take longer than a typical ADU?" }
```

---

## What needs to change in the frontend

**Currently** (`ChatRail.tsx`): calls `askRag()` — a stateless `POST /rag/chat` — for every question. Returns one full answer. No streaming.

**Target**: open a WebSocket to `/ws/rag/chat` and render text as chunks arrive.

---

## Step 1 — Open the WebSocket

Open one connection per parcel (reconnect when `detail.apn` changes, close on unmount):

```ts
const wsUrl = `${API_BASE.replace(/^http/, "ws")}/ws/rag/chat`;
const ws = new WebSocket(wsUrl);
```

`API_BASE` is already exported from `src/shared/config.ts`.

---

## Step 2 — Handle incoming frames

```ts
ws.onmessage = (evt) => {
  const msg = JSON.parse(evt.data);
  if (msg.type === "ping") return;

  if (msg.type === "chunk") {
    // Append msg.text to the last (pending) assistant turn
  }

  if (msg.type === "done") {
    // Mark last turn pending: false, set source: msg.source
    // setBusy(false)
  }
};
```

---

## Step 3 — Send a message

Replace the `askRag()` call with:

```ts
ws.send(JSON.stringify({ message: contextPrefix(detail, archetype) + q }));
```

The `contextPrefix()` function and the optimistic turn append stay exactly as-is.

---

## Step 4 — Render streaming text

| State | What to show |
|---|---|
| `pending: true`, `turn.text === ""` | `"Thinking…"` |
| `pending: true`, `turn.text` has content | Render live via `<Markdown>` (partial text is fine — system prompt outputs plain text) |
| `pending: false` | Normal render path, `source` badge if not `"live"` |

---

## Error / disconnect handling

```ts
ws.onerror = () => {
  // replace pending turn with { source: "error", text: "Could not reach the assistant." }
  // setBusy(false)
};

ws.onclose = (evt) => {
  if (!evt.wasClean) {
    // same as onerror — replace pending turn, setBusy(false)
  }
};
```

---

## What does NOT change

- `contextPrefix()` — identical, still injected on every send
- `openingTurn()` and the initial RAG result — still comes from `POST /parcel-detail`, not the WebSocket
- Turn shape `{ role, text, source, pending }` — identical
- All rendering, suggestions, scroll behavior, disabled-mode handling

---

## Imports to swap in ChatRail.tsx

| Remove | Add |
|---|---|
| `import { askRag } from "../lib/api"` | `import { API_BASE } from "../../../shared/config"` |
| `import { ApiUnavailable } from "../../../shared/api/client"` | *(nothing)* |

---

## TypeScript type for incoming frames

```ts
type WsEvent = {
  type: "chunk" | "done" | "ping";
  text?: string;    // present on "chunk"
  source?: string;  // present on "done": "live" | "mock"
  error?: string | null; // present on "done"
};
```
