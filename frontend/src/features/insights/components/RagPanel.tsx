import Markdown from "react-markdown";
import type { RagResult } from "../types";

/**
 * The RAG bot is a Gradio ChatInterface, not a JSON API. The server asks it
 * one free-text question and gets back a markdown answer, then regexes
 * bullet/numbered lines out of that answer as `reasons`.
 *
 * So `reasons` is a SUBSET of `sentiment_summary`, and rendering both
 * verbatim prints the same bullets twice. The older httpx client returned
 * them as genuinely separate values, so both shapes have to survive here —
 * hence the containment check rather than a hardcoded choice.
 */
function reasonsAreContainedIn(summary: string, reasons: string[]): boolean {
  if (reasons.length === 0) return true;
  const haystack = summary.toLowerCase();
  const contained = reasons.filter((r) => {
    const needle = r.toLowerCase().replace(/^[\s*\-\d.)]+/, "").slice(0, 40);
    return needle.length > 8 && haystack.includes(needle);
  }).length;
  return contained >= Math.ceil(reasons.length / 2);
}

const SOURCE_COPY: Record<RagResult["source"], { label: string; warn: string | null }> = {
  live: { label: "retrieved", warn: null },
  mock: {
    label: "mock",
    warn: "Not retrieved. Nothing below comes from a source document — it is placeholder text with the same shape as a real answer.",
  },
  error: {
    label: "unavailable",
    warn: "The assistant could not be reached. Nothing below is grounded.",
  },
};

export function RagPanel({ rag }: { rag: RagResult }) {
  const { label, warn } = SOURCE_COPY[rag.source] ?? SOURCE_COPY.error;
  const duplicated = reasonsAreContainedIn(rag.sentiment_summary, rag.reasons);

  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted">Assistant</h2>
        <span
          className={`mono text-[11px] ${rag.source === "live" ? "text-dim" : "text-accent"}`}
        >
          {label}
        </span>
      </div>

      {warn && (
        <p className="mt-3 rounded border border-accent/40 bg-accent/5 p-2.5 text-[11px] leading-relaxed">
          {warn}
          {rag.error && <span className="mono block mt-1 text-dim">{rag.error}</span>}
        </p>
      )}

      <div className="mt-4 space-y-2 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_strong]:text-text [&_p]:mt-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-muted [&_h2]:mt-4">
        <Markdown>{rag.sentiment_summary}</Markdown>
      </div>

      {!duplicated && rag.reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-edge/60 pt-4 text-sm">
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
