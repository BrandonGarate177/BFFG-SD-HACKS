import type { ParcelCapacity } from "../types";

const ROWS: Array<{ key: keyof ParcelCapacity; label: string; note?: string }> = [
  { key: "cap_base", label: "Base zoning" },
  { key: "cap_adu", label: "ADU" },
  { key: "cap_jadu", label: "JADU" },
  { key: "cap_sb9", label: "SB 9", note: "alternative to the above, not additive" },
  { key: "cap_total", label: "Total permitted" },
  { key: "delta_units", label: "Unbuilt capacity" },
];

export function CapacityPanel({ capacity }: { capacity: ParcelCapacity }) {
  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <h2 className="text-sm uppercase tracking-wider text-muted">By-right capacity</h2>

      <dl className="mt-4 space-y-2 text-sm">
        {ROWS.map(({ key, label, note }) => (
          <div key={key} className="flex items-baseline justify-between gap-4">
            <dt className={key === "delta_units" ? "font-medium" : "text-muted"}>
              {label}
              {note && <span className="ml-2 text-[10px] text-dim">{note}</span>}
            </dt>
            <dd className={`mono ${key === "delta_units" ? "text-accent" : ""}`}>
              {capacity[key] == null ? "—" : capacity[key]}
            </dd>
          </div>
        ))}
      </dl>

      {capacity.cap_adu_bonus_max != null && (
        <p className="mt-4 rounded border border-accent/40 bg-accent/5 p-2.5 text-[11px] leading-relaxed">
          ADU Bonus ceiling <span className="mono text-accent">{capacity.cap_adu_bonus_max}</span> —{" "}
          <strong>not by-right.</strong> Every bonus unit requires a deed-restricted affordable
          ADU plus a Sustainable Development Area location.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-dim">
        A screening estimate, not an entitlement determination. It ignores FAR, height,
        setbacks and parking, and cannot see historic districts, fire hazard zones or
        tenancy history. Real capacity is generally lower.
      </p>
    </section>
  );
}
