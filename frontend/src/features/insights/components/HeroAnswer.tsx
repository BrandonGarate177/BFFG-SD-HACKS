import {
  ARCHETYPE_LABEL,
  ARCHETYPE_UNITS,
  ARCHETYPES,
  hasThinSupport,
  type Archetype,
} from "../../../shared/domain/archetype";
import { daysToMonths, fmtUSD, fmtUSDExact } from "../../../shared/format";
import type { ArchetypePrediction, ParcelCapacity } from "../types";
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
  /** Carried from the map's slider via ?hardCost=. Null when absent. */
  hardCostPerUnit: number | null;
};

export function HeroAnswer({ archetype, onArchetype, prediction, capacity, hardCostPerUnit }: Props) {
  const months = prediction?.median_days == null ? null : daysToMonths(prediction.median_days);
  const units = ARCHETYPE_UNITS[archetype];
  const capacityUnits = capacity.delta_units;
  const exceedsCapacity = capacityUnits != null && units > capacityUnits;

  return (
    <section className="rounded-lg border border-edge bg-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{HEADLINE[archetype]}</h2>
          <p className="mt-1 text-sm text-muted">
            {capacityUnits == null
              ? "No quantifiable by-right capacity in this zone."
              : `By-right capacity is ${capacityUnits} unbuilt ${capacityUnits === 1 ? "unit" : "units"}.`}
          </p>
        </div>

        <div className="flex rounded border border-edge">
          {ARCHETYPES.map((a) => (
            <button
              key={a}
              onClick={() => onArchetype(a)}
              className={`px-2.5 py-1.5 text-xs transition-colors ${
                a === archetype
                  ? "bg-accent font-medium text-ink"
                  : "text-muted hover:text-text"
              }`}
            >
              {ARCHETYPE_LABEL[a]}
            </button>
          ))}
        </div>
      </div>

      {exceedsCapacity && (
        <p className="mt-4 rounded border border-accent/50 bg-accent/5 p-2.5 text-[11px] leading-relaxed">
          A {ARCHETYPE_LABEL[archetype].toLowerCase()} project needs {units} units, but this parcel's
          by-right capacity is {capacityUnits}. The timing below is what comparable projects took —
          it does not mean this parcel can accommodate one.
        </p>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="text-3xl font-semibold tracking-tight">
            {months == null ? "—" : `~${months.toFixed(1)} months`}
            <span className="ml-2 text-sm font-normal text-muted">to permit</span>
          </div>
          <ProbabilityStrip
            p180={prediction?.prob_issued_180d ?? null}
            p365={prediction?.prob_issued_365d ?? null}
          />
          {hasThinSupport(archetype) && (
            <p className="text-[11px] text-accent">
              Thin training data for this project size — directional only.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-3xl font-semibold tracking-tight">
            {prediction?.permit_fee_usd == null ? "—" : fmtUSDExact(prediction.permit_fee_usd)}
            <span className="ml-2 text-sm font-normal text-muted">permit fee</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            Building permit only — a floor. Excludes school fees, water and sewer capacity
            charges, and inclusionary housing.
            {prediction?.owes_dif && (
              <>
                {" "}
                <span className="text-accent">
                  Development Impact Fees also apply, and often exceed the permit itself.
                </span>
              </>
            )}
          </p>

          {hardCostPerUnit != null && (
            <p className="rounded border border-edge bg-ink/40 p-2.5 text-[11px] leading-relaxed text-muted">
              At your {fmtUSD(hardCostPerUnit)}/unit assumption from the map,{" "}
              {units} {units === 1 ? "unit" : "units"} is roughly{" "}
              <span className="mono text-text">{fmtUSD(units * hardCostPerUnit)}</span> to build.
              <span className="block text-dim">
                That is your assumption, not a model output — this dataset has no construction-cost model.
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
