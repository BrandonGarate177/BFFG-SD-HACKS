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
      <div className={`font-serif text-5xl leading-none ${muted ? "text-ink-2" : "text-ink"}`}>
        {value}
      </div>
      <div className="mt-2 text-sm text-ink-2">{label}</div>
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
    <section className="rounded-2xl border border-rule bg-card p-5 shadow-[0_20px_40px_-28px_rgba(43,29,18,.35)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Project size</div>
          <h2 className="mt-2 font-serif text-4xl leading-none sm:text-[44px]">{HEADLINE[archetype]}</h2>
        </div>

        <div className="flex flex-wrap gap-1 rounded-full border border-rule bg-wash p-1">
          {ARCHETYPES.map((a) => (
            <button
              key={a}
              onClick={() => onArchetype(a)}
              aria-pressed={a === archetype}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                a === archetype ? "bg-ink font-medium text-paper" : "text-ink-2 hover:text-ink"
              }`}
            >
              {ARCHETYPE_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      {noPath ? (
        <div className="mt-6 rounded-xl border border-dashed border-ink-2/50 bg-paper p-5">
          <div className="font-serif text-3xl leading-tight text-ink">No by-right path here</div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
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
              <dt className="text-ink-2">Comparable timing</dt>
              <dd className="mono">{months == null ? "—" : `~${months.toFixed(1)} mo`}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-ink-2">Comparable permit fee</dt>
              <dd className="mono">
                {prediction?.permit_fee_usd == null ? "—" : fmtUSD(prediction.permit_fee_usd)}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-6 border-t border-rule-soft pt-6 sm:grid-cols-3 sm:gap-8">
            <div className="space-y-2">
              <Figure value={capacityUnits} label="unbuilt homes zoning already permits" />
              {exceedsCapacity && (
                <p className="rounded-md bg-caution-bg px-2.5 py-2 text-sm leading-relaxed text-caution">
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
              <p className="text-sm text-ink-2">
                C-index <span className="mono text-ink">{MODEL.cIndex.toFixed(3)}</span> · chance{" "}
                {MODEL.cIndexChance.toFixed(3)} · linear baseline{" "}
                {MODEL.cIndexBaselineCox.toFixed(3)}
              </p>
              {hasThinSupport(archetype) && (
                <p className="rounded-md bg-caution-bg px-2.5 py-2 text-sm text-caution">
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
              <p className="text-sm leading-relaxed text-ink-2">
                Building permit only — a floor, and unverified against DSD's published table.
                Excludes school fees and water/sewer capacity charges.
                {prediction?.owes_dif && (
                  <span className="font-medium text-caution">
                    {" "}
                    Development Impact Fees also apply and often exceed it.
                  </span>
                )}
              </p>
              {hardCostPerUnit != null && (
                <p className="rounded-md bg-wash p-2.5 text-sm leading-relaxed text-ink-2">
                  At your {fmtUSD(hardCostPerUnit)}/unit assumption, {units}{" "}
                  {units === 1 ? "unit" : "units"} is roughly{" "}
                  <span className="mono text-ink">{fmtUSD(units * hardCostPerUnit)}</span> to build —
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
          <p className="mt-7 border-t border-rule-soft pt-5 text-base leading-relaxed text-ink-2">
            San Diego's code <strong className="font-medium text-ink">already permits these homes</strong>. What
            stands between them and a household is the time and cost above — and for an
            owner-built ADU, that wait is rent the owner is not collecting while they carry the
            loan.
          </p>
        </>
      )}
    </section>
  );
}
