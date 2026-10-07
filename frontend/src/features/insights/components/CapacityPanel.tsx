import type { ParcelCapacity } from "../types";

/**
 * SB 9 is an ALTERNATIVE to the base+ADU+JADU path, not additive -
 * cap_total is max(cap_base + cap_adu + cap_jadu, cap_sb9). Six flat rows
 * hide that, so this renders the two paths competing with the winner marked.
 */
function Path({
  label,
  formula,
  total,
  state,
}: {
  label: string;
  formula: string;
  total: number | null;
  state: "taken" | "tied" | "lost" | "unknown";
}) {
  const lit = state === "taken" || state === "tied";
  return (
    <div
      className={`flex items-baseline justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
        lit ? "border-ink/40 bg-paper" : "border-rule-soft"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        <div className="mono text-xs text-ink-2">{formula}</div>
      </div>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className={`font-serif text-2xl leading-none ${lit ? "text-ink" : "text-ink-2"}`}>
          {total ?? "—"}
        </span>
        {state === "taken" && (
          <span className="mono rounded-full bg-ok-bg px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-ok">taken</span>
        )}
        {state === "tied" && (
          <span className="mono rounded-full bg-ok-bg px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-ok">equivalent</span>
        )}
      </div>
    </div>
  );
}

export function CapacityPanel({ capacity }: { capacity: ParcelCapacity }) {
  const { cap_base, cap_adu, cap_jadu, cap_sb9, cap_total, delta_units, cap_adu_bonus_max } = capacity;

  const stacked =
    cap_base == null && cap_adu == null && cap_jadu == null
      ? null
      : (cap_base ?? 0) + (cap_adu ?? 0) + (cap_jadu ?? 0);

  /**
   * Across all 333,159 parcels where both paths are known, SB 9 never
   * exceeds the stacked path: it ties on 191,420 and loses on 141,739. So a
   * tie is the single most common outcome, and marking one path "taken"
   * there would read as SB 9 losing when it reaches the same number.
   */
  const bothKnown = cap_sb9 != null && stacked != null;
  const pathState = (mine: number | null, other: number | null) => {
    if (!bothKnown || mine == null || other == null) return "unknown" as const;
    if (mine === other) return "tied" as const;
    return mine > other ? ("taken" as const) : ("lost" as const);
  };

  if (cap_total == null && delta_units == null) {
    return (
      <section className="rounded-2xl border border-rule bg-card p-5 sm:p-6">
        <h2 className="eyebrow">By-right capacity</h2>
        <p className="mt-3 text-sm text-ink-2">
          No quantifiable residential entitlement in this zone — about 15% of parcels.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-rule bg-card p-5 sm:p-6">
      <h2 className="eyebrow">By-right capacity</h2>

      <div className="mt-4 space-y-2">
        <Path
          label="Base zoning + ADU"
          formula={`base ${cap_base ?? "—"} + ADU ${cap_adu ?? "—"} + JADU ${cap_jadu ?? "—"}`}
          total={stacked}
          state={pathState(stacked, cap_sb9)}
        />
        <Path
          label="SB 9 lot split"
          formula="alternative path, not additive"
          total={cap_sb9}
          state={pathState(cap_sb9, stacked)}
        />
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-rule-soft pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-2">Total permitted</dt>
          <dd className="mono">{cap_total ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Unbuilt capacity</dt>
          <dd className="mono font-medium">{delta_units ?? "—"}</dd>
        </div>
      </dl>

      {cap_adu_bonus_max != null && (
        <p className="mt-4 rounded-md border border-caution-rule bg-caution-bg p-2.5 text-sm leading-relaxed">
          ADU Bonus ceiling <span className="mono font-medium">{cap_adu_bonus_max}</span> —{" "}
          <strong className="text-caution">not by-right.</strong> Every bonus unit needs a deed-restricted affordable ADU
          plus a Sustainable Development Area location.
        </p>
      )}
    </section>
  );
}
