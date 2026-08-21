import { useState } from "react";
import { BUDGET, COST_ASSUMPTIONS, TIMEFRAME } from "../config";
import { MODEL } from "../../../shared/config";
import { fmtUSDExact, parseMonths, parseUSD } from "../../../shared/format";
import type { Filters } from "../lib/filters";
import { unitsAffordable } from "../lib/filters";

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

export function FilterPanel({ filters, onChange }: Props) {
  const units = unitsAffordable(filters);

  return (
    <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-edge bg-panel p-5 space-y-7 overflow-y-auto">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">By-right capacity</h1>
        <p className="text-xs text-muted leading-relaxed">
          City of San Diego parcels where zoning already permits homes that have not been built.
        </p>
      </header>

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
          Buys about <span className="mono text-text">{units}</span>{" "}
          {units === 1 ? "unit" : "units"} at the assumed cost below.
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

      <div className="border-t border-edge pt-5">
        <Row
          label="Assumption · cost per unit"
          value={
            <NumberField
              label="Assumed cost per unit in US dollars"
              value={filters.hardCostPerUnit}
              min={COST_ASSUMPTIONS.hardCostMin}
              max={COST_ASSUMPTIONS.hardCostMax}
              format={fmtUSDExact}
              parse={parseUSD}
              onCommit={(hardCostPerUnit) => onChange({ ...filters, hardCostPerUnit })}
              width="w-32"
            />
          }
        >
          <input
            type="range"
            className={slider}
            min={COST_ASSUMPTIONS.hardCostMin}
            max={COST_ASSUMPTIONS.hardCostMax}
            step={COST_ASSUMPTIONS.hardCostStep}
            value={filters.hardCostPerUnit}
            onChange={(e) => onChange({ ...filters, hardCostPerUnit: Number(e.target.value) })}
          />
        </Row>
        <p className="text-[11px] text-dim mt-2 leading-relaxed">
          <span className="text-accent">Not a model output.</span> Construction cost is
          not modelled by the permit data. Budget filtering is arithmetic over this figure —
          move it to see how much the result depends on the assumption.
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
