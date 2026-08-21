import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ApiUnavailable } from "../../../shared/api/client";
import { ARCHETYPE_LABEL, type Archetype } from "../../../shared/domain/archetype";
import { daysToMonths } from "../../../shared/format";
import { askRag } from "../lib/api";
import type { ParcelDetail, RagResult } from "../types";

type Turn = {
  role: "assistant" | "user";
  text: string;
  /** Assistant turns only: where the text came from. */
  source?: string;
  pending?: boolean;
};

const SUGGESTIONS = [
  "Why does this take longer than a typical ADU?",
  "What fees am I not seeing here?",
  "What would speed this up?",
];

/**
 * Builds the context prefix sent with every question.
 *
 * The parcel's facts and the model's numbers are INJECTED rather than left
 * for the model to recall. An inferred permit duration is exactly how a
 * wrong number gets spoken out loud, and the assistant has no access to
 * this parcel otherwise.
 */
function contextPrefix(detail: ParcelDetail, archetype: Archetype): string {
  const p = detail.parcel;
  const pred = detail.predictions[archetype];
  const bits = [
    `APN ${detail.apn}`,
    p.zone && `zoned ${p.zone}`,
    p.situs_community && `in ${p.situs_community}`,
    p.lot_sqft != null && `${Math.round(p.lot_sqft).toLocaleString()} sqft lot`,
    p.existing_units != null && `${p.existing_units} existing units`,
    detail.capacity.delta_units != null &&
      `by-right capacity for ${detail.capacity.delta_units} more units`,
    p.in_coastal_overlay && "inside the Coastal Overlay",
  ].filter(Boolean);

  const predBits = [
    pred?.median_days != null &&
      `median ${daysToMonths(pred.median_days).toFixed(1)} months to permit issuance`,
    pred?.permit_fee_usd != null && `permit fee about $${Math.round(pred.permit_fee_usd).toLocaleString()}`,
    pred?.owes_dif && "Development Impact Fees apply",
  ].filter(Boolean);

  return (
    `Context for this question — do not restate it back to me, and do not contradict these figures. ` +
    `Parcel: ${bits.join(", ")}. ` +
    `For a ${ARCHETYPE_LABEL[archetype]} project our model predicts: ${predBits.join(", ")}. ` +
    `Question: `
  );
}

export function ChatRail({
  detail,
  archetype,
  disabled,
}: {
  detail: ParcelDetail;
  archetype: Archetype;
  /** True in sample-data mode - the server is unreachable, so no asking. */
  disabled?: boolean;
}) {
  const initial = openingTurn(detail.rag_result);
  const [turns, setTurns] = useState<Turn[]>([initial]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset when navigating to a different parcel.
  useEffect(() => {
    setTurns([openingTurn(detail.rag_result)]);
    setDraft("");
  }, [detail.apn, detail.rag_result]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy || disabled) return;

    setDraft("");
    setBusy(true);
    setTurns((t) => [
      ...t,
      { role: "user", text: q },
      { role: "assistant", text: "", pending: true },
    ]);

    try {
      const res = await askRag(contextPrefix(detail, archetype) + q);
      setTurns((t) => [
        ...t.slice(0, -1),
        { role: "assistant", text: res.answer, source: res.source },
      ]);
    } catch (e) {
      setTurns((t) => [
        ...t.slice(0, -1),
        {
          role: "assistant",
          text:
            e instanceof ApiUnavailable
              ? `Could not reach the assistant. ${e.message}`
              : String(e),
          source: "error",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const notLive = turns.some((t) => t.role === "assistant" && t.source && t.source !== "live");

  return (
    <section className="flex max-h-[calc(100vh-6rem)] flex-col rounded-lg border border-edge bg-panel">
      <header className="flex items-baseline justify-between gap-2 border-b border-edge px-5 py-3">
        <h2 className="text-sm uppercase tracking-wider text-muted">Assistant</h2>
        {notLive && <span className="mono text-[11px] text-accent">not retrieved</span>}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <p key={i} className="ml-6 rounded-lg bg-edge/50 px-3 py-2 text-sm">
              {turn.text}
            </p>
          ) : turn.pending ? (
            <p key={i} className="text-sm text-dim">
              Thinking<span className="animate-pulse">…</span>
            </p>
          ) : (
            <div key={i} className="space-y-1">
              {turn.source && turn.source !== "live" && (
                <p className="rounded border border-accent/40 bg-accent/5 px-2.5 py-1.5 text-[11px] leading-relaxed">
                  {turn.source === "mock"
                    ? "Placeholder — not grounded in the permit statistics."
                    : "The assistant could not be reached."}
                </p>
              )}
              <div className="text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_p]:mt-2 [&_strong]:text-text [&_h2]:mt-3 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-muted">
                <Markdown>{turn.text}</Markdown>
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {!disabled && turns.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t border-edge px-5 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => void send(s)}
              className="rounded-full border border-edge px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-edge p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          className="flex-1 rounded border border-edge bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
          placeholder={disabled ? "Unavailable in sample mode" : "Ask about this parcel…"}
          value={draft}
          disabled={disabled || busy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          disabled={disabled || busy || !draft.trim()}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </section>
  );
}

/**
 * The server already composed and answered one parcel-specific question for
 * /parcel-detail, so the conversation opens with it rather than an empty box.
 * `reasons` is regexed out of that same text server-side, so only the full
 * answer is rendered - printing both would duplicate every bullet.
 */
function openingTurn(rag: RagResult): Turn {
  return { role: "assistant", text: rag.sentiment_summary, source: rag.source };
}
