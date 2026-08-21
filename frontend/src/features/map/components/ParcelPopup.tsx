import { PROB_1YR_FIELD, type TileParcel } from "../types";
import { ARCHETYPE_LABEL, ARCHETYPE_SUPPORT, hasThinSupport } from "../../../shared/domain/archetype";
import { parcelEconomics } from "../lib/cost";
import { fmtMonths, fmtUSD } from "../../../shared/format";

type Props = { parcel: TileParcel; x: number; y: number; hardCostPerUnit: number };

/**
 * Hover card. The whiteboard calls for value / income / residents; assessed
 * value and ACS demographics are not in the tile export, so this shows what
 * the data actually supports and the neighbourhood context it does carry.
 */
export function ParcelPopup({ parcel, x, y, hardCostPerUnit }: Props) {
  const econ = parcelEconomics(parcel, hardCostPerUnit);

  return (
    <div
      className="pointer-events-none absolute z-20 w-64 rounded-lg border border-edge bg-panel/97 p-3 shadow-2xl backdrop-blur"
      style={{ left: Math.min(x + 14, window.innerWidth - 290), top: Math.max(y - 10, 8) }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono text-[11px] text-muted">{parcel.apn}</span>
        <span className="mono text-[11px] text-accent">{parcel.zone}</span>
      </div>
      <div className="mt-0.5 text-sm font-medium">{parcel.situs_community ?? "Community unknown"}</div>

      {econ ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">By-right capacity</dt>
            <dd className="mono">+{econ.units} {econ.units === 1 ? "unit" : "units"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Project size</dt>
            <dd className="mono">{ARCHETYPE_LABEL[econ.archetype]}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Est. build cost</dt>
            <dd className="mono">{fmtUSD(econ.cost)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Median to permit</dt>
            <dd className="mono">{fmtMonths(econ.predMonths)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Issued within 1yr</dt>
            <dd className="mono">{Math.round((parcel[PROB_1YR_FIELD[econ.archetype]] as number) * 100)}%</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Lot</dt>
            <dd className="mono">{parcel.lot_sqft.toLocaleString()} sqft · {parcel.existing_units} built</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-dim">
          No quantifiable residential entitlement in this zone.
        </p>
      )}

      {econ && hasThinSupport(econ.archetype) && (
        <p className="mt-2 text-[10px] leading-snug text-accent">
          Thin training support ({ARCHETYPE_SUPPORT[econ.archetype]} permits) — directional only.
        </p>
      )}
      {parcel.coastal_deferred_certification && (
        <p className="mt-2 text-[10px] leading-snug text-accent-hi">
          Deferred certification — the Coastal Commission permits here, not the City.
        </p>
      )}
    </div>
  );
}
