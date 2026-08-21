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
  taken,
}: {
  label: string;
  formula: string;
  total: number | null;
  taken: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 rounded border px-3 py-2 ${
        taken ? "border-accent/50 bg-accent/5" : "border-edge"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        <div className="mono text-[11px] text-dim">{formula}</div>
      </div>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className={`mono text-lg ${taken ? "text-accent" : "text-muted"}`}>
          {total ?? "—"}
        </span>
        {taken && <span className="text-[10px] uppercase tracking-wider text-accent">taken</span>}
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

  // Only claim a winner when both paths are known.
  const sb9Wins = cap_sb9 != null && stacked != null && cap_sb9 > stacked;

  if (cap_total == null && delta_units == null) {
    return (
      <section className="rounded-lg border border-edge bg-panel p-5">
        <h2 className="text-sm uppercase tracking-wider text-muted">By-right capacity</h2>
        <p className="mt-3 text-sm text-dim">
          No quantifiable residential entitlement in this zone — about 15% of parcels.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <h2 className="text-sm uppercase tracking-wider text-muted">By-right capacity</h2>

      <div className="mt-4 space-y-2">
        <Path
          label="Base zoning + ADU"
          formula={`base ${cap_base ?? "—"} + ADU ${cap_adu ?? "—"} + JADU ${cap_jadu ?? "—"}`}
          total={stacked}
          taken={stacked != null && !sb9Wins}
        />
        <Path label="SB 9 lot split" formula="alternative path" total={cap_sb9} taken={sb9Wins} />
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-edge/60 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Total permitted</dt>
          <dd className="mono">{cap_total ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium">Unbuilt capacity</dt>
          <dd className="mono text-accent">{delta_units ?? "—"}</dd>
        </div>
      </dl>

      {cap_adu_bonus_max != null && (
        <p className="mt-4 rounded border border-accent/40 bg-accent/5 p-2.5 text-[11px] leading-relaxed">
          ADU Bonus ceiling <span className="mono text-accent">{cap_adu_bonus_max}</span> —{" "}
          <strong>not by-right.</strong> Every bonus unit needs a deed-restricted affordable ADU
          plus a Sustainable Development Area location.
        </p>
      )}
    </section>
  );
}
