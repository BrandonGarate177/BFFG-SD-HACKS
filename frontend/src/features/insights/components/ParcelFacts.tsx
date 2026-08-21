import type { ParcelContext } from "../types";

/**
 * Coastal jurisdiction codes, from data/README.md. DEF-CER is the one that
 * changes who permits the parcel, so it gets its own callout below.
 */
const COASTAL_ZONE_COPY: Record<string, string> = {
  "CST-APP": "Appealable to the Coastal Commission",
  "N-APP-1": "Non-appealable",
  "N-APP-2": "Non-appealable",
  "CST-PMT": "Commission retains permit authority",
  "DEF-CER": "Deferred certification",
  CSTZB: "Coastal zone boundary",
};

const dash = (v: unknown) => (v == null || v === "" ? "—" : String(v));

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="mono text-right">{value}</dd>
    </div>
  );
}

export function ParcelFacts({ parcel }: { parcel: ParcelContext }) {
  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <h2 className="text-sm uppercase tracking-wider text-muted">Parcel</h2>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-8">
        <Fact label="Zone" value={dash(parcel.zone)} />
        <Fact label="Use code" value={dash(parcel.nucleus_use_cd)} />
        <Fact
          label="Lot"
          value={parcel.lot_sqft == null ? "—" : `${Math.round(parcel.lot_sqft).toLocaleString()} sqft`}
        />
        <Fact label="Existing units" value={dash(parcel.existing_units)} />
        <Fact label="Community" value={dash(parcel.situs_community)} />
        <Fact label="ZIP" value={dash(parcel.situs_zip)} />
        <Fact label="ADU eligible" value={parcel.adu_eligible == null ? "—" : parcel.adu_eligible ? "yes" : "no"} />
        <Fact label="SB 9 eligible" value={parcel.sb9_eligible == null ? "—" : parcel.sb9_eligible ? "yes" : "no"} />
      </dl>

      {parcel.in_coastal_overlay && (
        <p className="mt-4 rounded border border-edge bg-ink/40 p-2.5 text-sm leading-relaxed">
          <span className="text-muted">Coastal Overlay</span>
          {parcel.coastal_zone && (
            <>
              {" · "}
              <span className="mono text-accent">{parcel.coastal_zone}</span>
              {COASTAL_ZONE_COPY[parcel.coastal_zone] && ` — ${COASTAL_ZONE_COPY[parcel.coastal_zone]}`}
            </>
          )}
        </p>
      )}

      {/* Coastal jurisdiction warnings live in WatchOut, not duplicated here. */}
    </section>
  );
}
