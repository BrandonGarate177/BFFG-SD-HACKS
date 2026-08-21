import type { RagResult } from "../types";

const SOURCE_LABEL: Record<RagResult["source"], string> = {
  live: "live",
  mock: "mock fallback",
  error: "unavailable",
};

export function RagPanel({ rag }: { rag: RagResult }) {
  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted">Context</h2>
        <span className="mono text-[11px] text-dim">{SOURCE_LABEL[rag.source]}</span>
      </div>

      {rag.source !== "live" && (
        <p className="mt-3 rounded border border-accent/40 bg-accent/5 p-2.5 text-[11px] leading-relaxed">
          Not retrieved. {rag.error ?? "RAG_API_URL is unset, so the server returned a deterministic placeholder."}{" "}
          Nothing below is grounded in a source document.
        </p>
      )}

      <p className="mt-3 text-sm leading-relaxed">{rag.sentiment_summary}</p>

      {rag.reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {rag.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-accent">·</span>
              <span className="text-text/90">{r}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
