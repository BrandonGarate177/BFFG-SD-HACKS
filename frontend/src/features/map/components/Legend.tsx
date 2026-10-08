import { CAPACITY_STOPS, CONTEXT_COLOR, CONTEXT_OPACITY } from "../lib/map";

/**
 * Key for the parcel colours. Reads the same stops the fill expression is
 * built from, so the two cannot drift.
 */
export function Legend() {
  const gradient = `linear-gradient(90deg, ${CAPACITY_STOPS.map(([, c]) => c).join(", ")})`;
  const last = CAPACITY_STOPS.length - 1;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 w-44 sm:w-56 rounded-lg border border-rule bg-card/95 px-3 py-2.5 shadow-[0_12px_28px_-16px_rgba(43,29,18,.5)] backdrop-blur">
      <div className="eyebrow">Unbuilt homes per parcel</div>
      <div className="mt-2 h-2 rounded-sm" style={{ background: gradient }} />
      <div className="mono mt-1 flex justify-between text-[11px] text-ink-2">
        {CAPACITY_STOPS.map(([units], i) => (
          <span key={units}>{i === last ? `${units}+` : units}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-rule-soft pt-2 text-[11px] text-ink-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: CONTEXT_COLOR, opacity: CONTEXT_OPACITY }}
        />
        Has capacity, outside your filters
      </div>
    </div>
  );
}
