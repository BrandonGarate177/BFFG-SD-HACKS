import { PROB_1YR_FIELD, type TileParcel } from "../types";
import {
  ARCHETYPE_LABEL,
  ARCHETYPE_SUPPORT,
  hasThinSupport,
  type Archetype,
} from "../../../shared/domain/archetype";
import { parcelEconomics } from "../lib/cost";
import { fmtMonths, fmtUSD } from "../../../shared/format";

type Props = {
  parcel: TileParcel;
  x: number;
  y: number;
  hardCostPerUnit: Record<Archetype, number>;
};

/**
 * Hover card. The whiteboard calls for value / income / residents; assessed
 * value and ACS demographics are not in the tile export, so this shows what
 * the data actually supports and the neighbourhood context it does carry.
 */
export function ParcelPopup({ parcel, x, y, hardCostPerUnit }: Props) {
  const econ = parcelEconomics(parcel, hardCostPerUnit);

  return (
    <div
      className="pointer-events-none absolute z-20 w-64 rounded-xl border border-rule bg-card/97 p-3.5 shadow-[0_24px_48px_-20px_rgba(43,29,18,.55)] backdrop-blur"
      style={{ left: Math.min(x + 14, window.innerWidth - 290), top: Math.max(y - 10, 8) }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono text-[11px] text-ink-2">{parcel.apn}</span>
        <span className="mono rounded-full bg-wash px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-ink-2">{parcel.zone}</span>
      </div>
      <div className="mt-1 font-serif text-xl leading-tight">{parcel.situs_community ?? "Community unknown"}</div>

      {econ ? (
        <dl className="mt-3 divide-y divide-rule-soft border-t border-rule-soft text-xs">
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">By-right capacity</dt>
            <dd className="mono">+{econ.units} {econ.units === 1 ? "unit" : "units"}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">Project size</dt>
            <dd className="mono">{ARCHETYPE_LABEL[econ.archetype]}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">Est. build cost</dt>
            <dd className="mono">{fmtUSD(econ.cost)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">Median to permit</dt>
            <dd className="mono">{fmtMonths(econ.predMonths)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">Issued within 1yr</dt>
            <dd className="mono">{Math.round((parcel[PROB_1YR_FIELD[econ.archetype]] as number) * 100)}%</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ink-2">Lot</dt>
            <dd className="mono">{parcel.lot_sqft.toLocaleString()} sqft · {parcel.existing_units} built</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-ink-2">
          No quantifiable residential entitlement in this zone.
        </p>
      )}

      {econ && hasThinSupport(econ.archetype) && (
        <p className="mt-2 rounded-md bg-caution-bg px-2 py-1.5 text-[11px] leading-snug text-caution">
          Thin training support ({ARCHETYPE_SUPPORT[econ.archetype]} permits) — directional only.
        </p>
      )}
      {parcel.coastal_deferred_certification && (
        <p className="mt-2 rounded-md bg-caution-bg px-2 py-1.5 text-[11px] leading-snug text-caution">
          Deferred certification — the Coastal Commission permits here, not the City.
        </p>
      )}
    </div>
  );
}
