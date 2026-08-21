import { BUDGET, COST_ASSUMPTIONS, TIMEFRAME } from "../config";
import { MODEL } from "../../../shared/config";
import { fmtUSD, fmtUSDExact } from "../../../shared/format";
import type { Filters } from "../lib/filters";
import { unitsAffordable } from "../lib/filters";

type Props = {
  filters: Filters;
  onChange: (next: Filters) => void;
  matchCount: number | null;
};

function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs uppercase tracking-wider text-muted">{label}</label>
        <span className="mono text-sm text-accent">{value}</span>
      </div>
      {children}
    </div>
  );
}

const slider = "range-accent";

export function FilterPanel({ filters, onChange, matchCount }: Props) {
  const units = unitsAffordable(filters);

  return (
    <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-edge bg-panel p-5 space-y-7 overflow-y-auto">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">By-right capacity</h1>
        <p className="text-xs text-muted leading-relaxed">
          City of San Diego parcels where zoning already permits homes that have not been built.
        </p>
      </header>

      <Row label="Budget" value={fmtUSD(filters.budgetUsd)}>
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

      <Row label="Time frame" value={`${filters.timeframeMonths} mo`}>
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
        <Row label="Assumption · cost per unit" value={fmtUSDExact(filters.hardCostPerUnit)}>
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

      <div className="border-t border-edge pt-5 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-muted">Matching</span>
          <span className="mono text-sm">
            {matchCount == null ? "—" : matchCount.toLocaleString()}
            <span className="text-dim text-xs"> in view</span>
          </span>
        </div>
        <p className="text-[11px] text-dim leading-relaxed">
          Counts what is drawn on screen. Panning changes it; it is not a citywide total.
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
