import {
  ARCHETYPE_LABEL,
  ARCHETYPE_UNITS,
  ARCHETYPES,
  hasThinSupport,
  type Archetype,
} from "../../../shared/domain/archetype";
import { MODEL } from "../../../shared/config";
import { daysToMonths, fmtUSD } from "../../../shared/format";
import type { ArchetypePrediction, ParcelCapacity, ParcelContext } from "../types";
import { ProbabilityStrip } from "./ProbabilityStrip";

const HEADLINE: Record<Archetype, string> = {
  adu: "Add an ADU",
  duplex: "Build 2 units",
  "3_4_unit": "Build 3–4 units",
  "5plus": "Build 5+ units",
};

type Props = {
  archetype: Archetype;
  onArchetype: (a: Archetype) => void;
  prediction: ArchetypePrediction | undefined;
  capacity: ParcelCapacity;
  parcel: ParcelContext;
  /** Carried from the map's slider via ?hardCost=. Null when absent. */
  hardCostPerUnit: number | null;
};

function Figure({
  value,
  label,
  muted = false,
}: {
  value: React.ReactNode;
  label: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className={`text-4xl font-semibold tracking-tight ${muted ? "text-muted" : "text-accent"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

export function HeroAnswer({
  archetype,
  onArchetype,
  prediction,
  capacity,
  parcel,
  hardCostPerUnit,
}: Props) {
  const months = prediction?.median_days == null ? null : daysToMonths(prediction.median_days);
  const units = ARCHETYPE_UNITS[archetype];
  const capacityUnits = capacity.delta_units;

  /**
   * "No by-right path" is a different answer from "this many units", and it
   * has to suppress the figures rather than sit beside them. A 40px
   * confident number for a project the zone does not permit is the exact
   * failure every other caveat on this page exists to prevent.
   */
  const eligible =
    archetype === "adu" ? parcel.adu_eligible !== false : true;
  const noPath = capacityUnits == null || capacityUnits <= 0 || !eligible;
  const exceedsCapacity = !noPath && capacityUnits != null && units > capacityUnits;

  return (
    <section className="rounded-lg border border-edge bg-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">{HEADLINE[archetype]}</h2>

        <div className="flex overflow-hidden rounded border border-edge">
          {ARCHETYPES.map((a) => (
            <button
              key={a}
              onClick={() => onArchetype(a)}
              aria-pressed={a === archetype}
              className={`px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                a === archetype ? "bg-accent font-semibold text-ink" : "text-muted hover:text-text"
              }`}
            >
              {ARCHETYPE_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      {noPath ? (
        <div className="mt-5 rounded border-2 border-dashed border-edge p-5">
          <div className="text-2xl font-semibold text-muted">No by-right path here</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {capacityUnits == null
              ? "This zone has no quantifiable residential entitlement — about 15% of parcels."
              : !eligible
                ? "This parcel is not ADU-eligible."
                : "Zoning permits no additional units beyond what is already built."}{" "}
            The figures below are what <em>comparable</em> projects elsewhere took. They are not a
            timeline for this parcel.
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted">Comparable timing</dt>
              <dd className="mono">{months == null ? "—" : `~${months.toFixed(1)} mo`}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">Comparable permit fee</dt>
              <dd className="mono">
                {prediction?.permit_fee_usd == null ? "—" : fmtUSD(prediction.permit_fee_usd)}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Figure value={capacityUnits} label="unbuilt homes zoning already permits" />
              {exceedsCapacity && (
                <p className="text-sm leading-relaxed text-accent">
                  A {ARCHETYPE_LABEL[archetype]} project needs {units}. Timing below is what
                  comparable projects took.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Figure value={months == null ? "—" : `${months.toFixed(1)} mo`} label="median to permit" />
              <ProbabilityStrip
                p180={prediction?.prob_issued_180d ?? null}
                p365={prediction?.prob_issued_365d ?? null}
              />
              <p className="text-sm text-muted">
                C-index <span className="mono text-text">{MODEL.cIndex.toFixed(3)}</span> · chance{" "}
                {MODEL.cIndexChance.toFixed(3)} · linear baseline{" "}
                {MODEL.cIndexBaselineCox.toFixed(3)}
              </p>
              {hasThinSupport(archetype) && (
                <p className="text-sm text-accent">
                  Under 1,000 training permits at this size — directional only.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Figure
                value={prediction?.permit_fee_usd == null ? "—" : fmtUSD(prediction.permit_fee_usd)}
                label="permit fee"
                muted
              />
              <p className="text-sm leading-relaxed text-muted">
                Building permit only — a floor, and unverified against DSD's published table.
                Excludes school fees and water/sewer capacity charges.
                {prediction?.owes_dif && (
                  <span className="text-accent">
                    {" "}
                    Development Impact Fees also apply and often exceed it.
                  </span>
                )}
              </p>
              {hardCostPerUnit != null && (
                <p className="rounded border border-edge bg-ink/40 p-2.5 text-sm leading-relaxed text-muted">
                  At your {fmtUSD(hardCostPerUnit)}/unit assumption, {units}{" "}
                  {units === 1 ? "unit" : "units"} is roughly{" "}
                  <span className="mono text-text">{fmtUSD(units * hardCostPerUnit)}</span> to build —
                  your assumption, not a model output.
                </p>
              )}
            </div>
          </div>

          {/*
            Why this belongs in a cost-of-living track. Without a line like
            this the page reads as a pure land-use tool, and a judge has to
            infer the affordability connection themselves.
          */}
          <p className="mt-6 border-t border-edge pt-4 text-base leading-relaxed text-muted">
            San Diego's code <strong className="text-text">already permits these homes</strong>. What
            stands between them and a household is the time and cost above — and for an
            owner-built ADU, that wait is rent the owner is not collecting while they carry the
            loan.
          </p>
        </>
      )}
    </section>
  );
}
