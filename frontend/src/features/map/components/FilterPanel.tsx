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
import { fmtUSDExact, parseMonths, parseUSD } from "../../../shared/format";
import type { Filters } from "../lib/filters";
import { rateInertness, unitsAffordable } from "../lib/filters";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
};

function Row({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs uppercase tracking-wider text-muted">{label}</label>
        {value}
      </div>
      {children}
    </div>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

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
      className={`mono ${width} rounded border bg-ink/40 px-2 py-0.5 text-right text-sm outline-none ${
        invalid ? "border-red-400/70 text-red-300" : "border-edge/70 text-accent focus:border-accent"
      }`}
    />
  );
}

const slider = "range-accent";

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
        <p className="text-[11px] text-dim leading-relaxed">
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
  const units = unitsAffordable(filters);
  const selected = filters.archetype;

  return (
    <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-edge bg-panel p-5 space-y-7 overflow-y-auto">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">By-right capacity</h1>
        <p className="text-xs text-muted leading-relaxed">
          City of San Diego parcels where zoning already permits homes that have not been built.
        </p>
      </header>

      <div className="space-y-2">
        <label
          htmlFor="project-type"
          className="block text-xs uppercase tracking-wider text-muted"
        >
          Project type
        </label>
        <select
          id="project-type"
          className="mono w-full rounded border border-edge/70 bg-ink/40 px-2 py-1.5 text-sm text-accent outline-none focus:border-accent"
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
        <p className="text-[11px] text-dim leading-relaxed">
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
          min={BUDGET.min}
          max={BUDGET.max}
          step={BUDGET.step}
          value={filters.budgetUsd}
          onChange={(e) => onChange({ ...filters, budgetUsd: Number(e.target.value) })}
        />
        <p className="text-[11px] text-dim">
          {units === 0 ? (
            <>Buys nothing at the rates below, so no parcel can match.</>
          ) : (
            <>
              Buys about <span className="mono text-text">{units}</span>{" "}
              {units === 1 ? "unit" : "units"} at the rates below.
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
          min={TIMEFRAME.minMonths}
          max={TIMEFRAME.maxMonths}
          step={TIMEFRAME.stepMonths}
          value={filters.timeframeMonths}
          onChange={(e) => onChange({ ...filters, timeframeMonths: Number(e.target.value) })}
        />
        <p className="text-[11px] text-dim">
          Median predicted days from application to permit issuance, for the project size
          each parcel's capacity implies.
        </p>
      </Row>

      <div className="border-t border-edge pt-5 space-y-4">
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wider text-muted">
            Assumption · cost per unit
          </span>
          <p className="text-[11px] text-dim leading-relaxed">
            <span className="text-accent">Not a model output.</span> Construction cost is
            not modelled by the permit data. Budget filtering is arithmetic over these
            figures — move them to see how much the result depends on the assumption.
          </p>
        </div>

        {(selected ? [selected] : ARCHETYPES).map((a) => (
          <CostRow key={a} archetype={a} filters={filters} onChange={onChange} />
        ))}

        <p className="text-[11px] text-dim leading-relaxed">
          {selected
            ? "Showing the rate for the selected type. Switch to All types to edit the others."
            : "Each parcel is priced at the rate for its own by-right capacity."}{" "}
          ADU and 5+ are anchored to published San Diego figures; duplex and 3-4 unit are
          interpolated between them and are the softest numbers here. All four exclude
          land, permit fees and design, so they are a floor. Provenance is in{" "}
          <span className="mono text-muted">config.ts</span>.
        </p>
      </div>

      <footer className="border-t border-edge pt-4 text-[11px] text-dim leading-relaxed space-y-2">
        <p>
          Model C-index <span className="mono text-text">{MODEL.cIndex.toFixed(3)}</span>{" "}
          against {MODEL.cIndexChance.toFixed(1)} for chance and{" "}
          {MODEL.cIndexBaselineCox.toFixed(3)} for a linear baseline. It ranks parcels better
          than chance; treat single numbers as directional.
        </p>
        <p>
          Capacity is a screening estimate. It ignores FAR, height, setbacks and parking,
          so real capacity is generally lower.
        </p>
      </footer>
    </aside>
  );
}
