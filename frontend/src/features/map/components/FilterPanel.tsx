import { useState } from "react";
import { BUDGET, COST_ASSUMPTIONS, TIMEFRAME } from "../config";
import {
  ARCHETYPES,
  ARCHETYPE_LABEL,
  ARCHETYPE_MAX_UNITS,
  ARCHETYPE_UNITS,
  type Archetype,
} from "../../../shared/domain/archetype";
import { MODEL } from "../../../shared/config";
import { fmtUSD, fmtUSDExact, parseMonths, parseUSD } from "../../../shared/format";
import type { Filters } from "../lib/filters";
import harvesters640 from "../art/harvesters-640.webp";
import harvesters960 from "../art/harvesters-960.webp";
import { budgetReach, rateInertness } from "../lib/filters";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
};

function Row({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="eyebrow">{label}</label>
        {value}
      </div>
      {children}
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Fixed set, so spell the article out rather than guess from the spelling. */
const ARTICLE: Record<Archetype, string> = {
  adu: "An",
  duplex: "A",
  "3_4_unit": "A",
  "5plus": "A",
};

/** "3-4 units", "5+ units" - the capacity range a project size covers. */
function bandLabel(a: Archetype): string {
  const lo = ARCHETYPE_UNITS[a];
  const hi = ARCHETYPE_MAX_UNITS[a];
  if (!Number.isFinite(hi)) return `${lo}+ units`;
  if (lo === hi) return lo === 1 ? "1 unit" : `${lo} units`;
  return `${lo}-${hi} units`;
}

/**
 * The readout doubles as an input. Typing commits on Enter or blur and the
 * slider follows on its own, because both controls render the same filter
 * state - there is no second source of truth to keep in sync.
 *
 * The in-progress text is held locally so a half-typed number is never
 * clamped mid-keystroke: "1" on the way to "1200000" would otherwise snap to
 * the minimum and eat the rest of the digits.
 */
function NumberField({
  value,
  min,
  max,
  format,
  parse,
  onCommit,
  label,
  width,
}: {
  value: number;
  min: number;
  max: number;
  format: (n: number) => string;
  parse: (s: string) => number | null;
  onCommit: (n: number) => void;
  label: string;
  width: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? null : parse(draft);
  const invalid = draft !== null && parsed === null;

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft ?? format(value)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        const el = e.currentTarget;
        setDraft(String(value));
        // After the re-render, so the selection lands on the raw digits.
        requestAnimationFrame(() => el.select());
      }}
      onBlur={() => {
        if (parsed !== null) onCommit(clamp(parsed, min, max));
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        // Escape reverts by dropping the draft; the field falls back to
        // rendering the committed value, still focused.
        else if (e.key === "Escape") setDraft(null);
      }}
      className={`mono ${width} rounded-md border bg-wash px-2 py-1 text-right text-sm ${
        invalid ? "border-danger text-danger" : "border-rule text-ink focus:border-ink"
      }`}
    />
  );
}

const slider = "range-ink";

/** One archetype's rate: typed field plus slider, sharing filter state. */
function CostRow({
  archetype,
  filters,
  onChange,
}: {
  archetype: Archetype;
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const set = (n: number) =>
    onChange({ ...filters, hardCostPerUnit: { ...filters.hardCostPerUnit, [archetype]: n } });
  const inert = rateInertness(
    filters,
    archetype,
    COST_ASSUMPTIONS.hardCostMin,
    COST_ASSUMPTIONS.hardCostMax,
  );

  return (
    <Row
      label={ARCHETYPE_LABEL[archetype]}
      value={
        <NumberField
          label={`Assumed cost per unit for ${ARCHETYPE_LABEL[archetype]}, in US dollars`}
          value={filters.hardCostPerUnit[archetype]}
          min={COST_ASSUMPTIONS.hardCostMin}
          max={COST_ASSUMPTIONS.hardCostMax}
          format={fmtUSDExact}
          parse={parseUSD}
          onCommit={set}
          width="w-32"
        />
      }
    >
      <input
        type="range"
        className={slider}
        aria-label={`${ARCHETYPE_LABEL[archetype]} cost per unit`}
        min={COST_ASSUMPTIONS.hardCostMin}
        max={COST_ASSUMPTIONS.hardCostMax}
        step={COST_ASSUMPTIONS.hardCostStep}
        value={filters.hardCostPerUnit[archetype]}
        onChange={(e) => set(Number(e.target.value))}
      />
      {inert && (
        <p className="text-[12px] text-ink-2 leading-relaxed">
          No effect at this budget —{" "}
          {inert === "all-affordable" ? (
            <>
              every {ARCHETYPE_LABEL[archetype]} parcel is affordable at any rate on this
              scale. Lower the budget to make it bite.
            </>
          ) : (
            <>
              no {ARCHETYPE_LABEL[archetype]} parcel is affordable at any rate on this
              scale. Raise the budget to make it bite.
            </>
          )}
        </p>
      )}
    </Row>
  );
}

export function FilterPanel({ filters, onChange }: Props) {
  const reach = budgetReach(filters);
  const selected = filters.archetype;

  /** Enough of the rates to read at a glance while collapsed. */
  const rates = (selected ? [selected] : ARCHETYPES).map((a) => filters.hardCostPerUnit[a]);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  const rateSummary = lo === hi ? fmtUSDExact(lo) : `${fmtUSD(lo)}–${fmtUSD(hi)}`;

  return (
    <aside className="w-full shrink-0 border-t border-rule bg-card lg:w-[22rem] lg:overflow-y-auto lg:border-l lg:border-t-0">
      <figure className="relative h-28 overflow-hidden lg:h-36">
        <img
          src={harvesters640}
          srcSet={`${harvesters640} 640w, ${harvesters960} 960w`}
          sizes="(min-width: 1024px) 22rem, 100vw"
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[50%_62%]"
        />
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-5 pb-2 pt-6 font-mono text-[9.5px] uppercase tracking-[.1em] text-white/85">
          Bruegel, The Harvesters, 1565 · The Met, CC0
        </figcaption>
      </figure>

      <div className="space-y-7 p-5">
        <header className="space-y-2">
          <div className="eyebrow">By-Right · San Diego</div>
          <h1 className="font-serif text-[32px] leading-[1.05] tracking-[-0.01em]">By-right capacity</h1>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            City of San Diego parcels where zoning already permits homes that have not been built.
          </p>
        </header>

        <div className="space-y-2">
          <label
            htmlFor="project-type"
            className="eyebrow block"
          >
            Project type
          </label>
          <select
            id="project-type"
            className="w-full rounded-md border border-rule bg-card px-2.5 py-2 text-sm text-ink focus:border-ink"
            value={filters.archetype ?? "all"}
            onChange={(e) =>
              onChange({
                ...filters,
                archetype: e.target.value === "all" ? null : (e.target.value as Archetype),
              })
            }
          >
            <option value="all">All types</option>
            {ARCHETYPES.map((a) => (
              <option key={a} value={a}>
                {ARCHETYPE_LABEL[a]} · {bandLabel(a)}
              </option>
            ))}
          </select>
          <p className="text-[12px] text-ink-2 leading-relaxed">
            {selected
              ? `Showing only parcels whose by-right capacity is ${bandLabel(selected)}.`
              : "Showing every parcel with by-right capacity, priced at the rate for its own size."}
          </p>
        </div>

        <Row
          label="Budget"
          value={
            <NumberField
              label="Budget in US dollars"
              value={filters.budgetUsd}
              min={BUDGET.min}
              max={BUDGET.max}
              format={fmtUSDExact}
              parse={parseUSD}
              onCommit={(budgetUsd) => onChange({ ...filters, budgetUsd })}
              width="w-32"
            />
          }
        >
          <input
            type="range"
            className={slider}
            aria-label="Budget"
            min={BUDGET.min}
            max={BUDGET.max}
            step={BUDGET.step}
            value={filters.budgetUsd}
            onChange={(e) => onChange({ ...filters, budgetUsd: Number(e.target.value) })}
          />
          <p className="text-[12px] text-ink-2 leading-relaxed">
            {reach.kind === "none" ? (
              <>Buys nothing at the rates below, so no parcel can match.</>
            ) : reach.kind === "money-bound" ? (
              <>
                Buys about <span className="mono text-ink">{reach.units}</span>{" "}
                {reach.units === 1 ? "unit" : "units"} at the rates below.
              </>
            ) : (
              <>
                {ARTICLE[reach.archetype]} {ARCHETYPE_LABEL[reach.archetype]} project is{" "}
                <span className="mono text-ink">{reach.units}</span>{" "}
                {reach.units === 1 ? "unit" : "units"} at about{" "}
                <span className="mono text-ink">{fmtUSD(reach.cost)}</span> — the project
                size caps it, not your money. <span className="mono text-ink">
                  {fmtUSD(reach.spare)}
                </span>{" "}
                of the budget is spare.
              </>
            )}
          </p>
        </Row>

        <Row
          label="Time frame"
          value={
            <NumberField
              label="Time frame in months"
              value={filters.timeframeMonths}
              min={TIMEFRAME.minMonths}
              max={TIMEFRAME.maxMonths}
              format={(m) => `${m} mo`}
              parse={parseMonths}
              onCommit={(timeframeMonths) => onChange({ ...filters, timeframeMonths })}
              width="w-20"
            />
          }
        >
          <input
            type="range"
            className={slider}
            aria-label="Time frame"
            min={TIMEFRAME.minMonths}
            max={TIMEFRAME.maxMonths}
            step={TIMEFRAME.stepMonths}
            value={filters.timeframeMonths}
            onChange={(e) => onChange({ ...filters, timeframeMonths: Number(e.target.value) })}
          />
          <p className="text-[12px] text-ink-2 leading-relaxed">
            Median predicted days from application to permit issuance, for the project size
            each parcel's capacity implies.
          </p>
        </Row>

        {/*
          Secondary by rank, not by importance: budget, time frame and project
          type are the question being asked, these are how the answer is
          computed. Native <details> so it is keyboard-operable for free.
          The "not a model output" label stays visible when collapsed - the
          caveat is the one part that must not be behind a click.
        */}
        <details className="group border-t border-rule pt-5">
          <summary className="cursor-pointer list-none space-y-1.5 rounded-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow">
                <span className="mr-1 inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>
                Assumptions · cost per unit
              </span>
              <span className="mono shrink-0 text-sm text-ink">{rateSummary}</span>
            </div>
            <p className="text-[12px] text-ink-2 leading-relaxed">
              <span className="font-medium text-caution">Not a model output.</span> Construction cost is
              not modelled by the permit data — open to adjust it.
            </p>
          </summary>

          <div className="mt-4 space-y-4">
            {(selected ? [selected] : ARCHETYPES).map((a) => (
              <CostRow key={a} archetype={a} filters={filters} onChange={onChange} />
            ))}

            <p className="text-[12px] text-ink-2 leading-relaxed">
              {selected
                ? "Showing the rate for the selected type. Switch to All types to edit the others."
                : "Each parcel is priced at the rate for its own by-right capacity."}{" "}
              ADU and 5+ are anchored to published San Diego figures; duplex and 3-4 unit are
              interpolated between them and are the softest numbers here. All four exclude
              land, permit fees and design, so they are a floor. Provenance is in{" "}
              <span className="mono text-ink">config.ts</span>.
            </p>
          </div>
        </details>

        <footer className="border-t border-rule pt-4 text-[12px] text-ink-2 leading-relaxed space-y-2">
          <p>
            Model C-index <span className="mono text-ink">{MODEL.cIndex.toFixed(3)}</span>{" "}
            against {MODEL.cIndexChance.toFixed(1)} for chance and{" "}
            {MODEL.cIndexBaselineCox.toFixed(3)} for a linear baseline. It ranks parcels better
            than chance; treat single numbers as directional.
          </p>
          <p>
            Capacity is a screening estimate. It ignores FAR, height, setbacks and parking,
            so real capacity is generally lower.
          </p>
        </footer>
      </div>
    </aside>
  );
}
