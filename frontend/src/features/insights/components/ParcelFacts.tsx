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
      <dt className="text-ink-2">{label}</dt>
      <dd className="mono text-right">{value}</dd>
    </div>
  );
}

export function ParcelFacts({ parcel }: { parcel: ParcelContext }) {
  return (
    <section className="rounded-2xl border border-rule bg-card p-5 sm:p-6">
      <h2 className="eyebrow">Parcel</h2>

      <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
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
        <p className="mt-4 rounded-md bg-wash p-2.5 text-sm leading-relaxed">
          <span className="text-ink-2">Coastal Overlay</span>
          {parcel.coastal_zone && (
            <>
              {" · "}
              <span className="mono font-medium">{parcel.coastal_zone}</span>
              {COASTAL_ZONE_COPY[parcel.coastal_zone] && ` — ${COASTAL_ZONE_COPY[parcel.coastal_zone]}`}
            </>
          )}
        </p>
      )}

      {/* Coastal jurisdiction warnings live in WatchOut, not duplicated here. */}
    </section>
  );
}
