import { ARCHETYPE_LABEL, ARCHETYPES, hasThinSupport, type Archetype } from "../../../shared/domain/archetype";
import { daysToMonths, fmtMonths, fmtPct, fmtUSDExact } from "../../../shared/format";
import type { ArchetypePrediction, ModelInfo } from "../types";

type Props = {
  predictions: Record<Archetype, ArchetypePrediction>;
  modelInfo: ModelInfo;
};

export function PredictionPanel({ predictions, modelInfo }: Props) {
  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted">Permit timing</h2>
        <span className="mono text-[11px] text-dim">
          C-index {modelInfo.model_c_index.toFixed(3)} · as of {modelInfo.predictions_as_of}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-dim">
              <th className="pb-2 font-medium">Project</th>
              <th className="pb-2 font-medium">Median</th>
              <th className="pb-2 font-medium">180d</th>
              <th className="pb-2 font-medium">1yr</th>
              <th className="pb-2 font-medium">Permit fee</th>
            </tr>
          </thead>
          <tbody>
            {ARCHETYPES.map((a) => {
              const p = predictions[a];
              if (!p) return null;
              return (
                <tr key={a} className="border-t border-edge/60">
                  <td className="py-2">
                    {ARCHETYPE_LABEL[a]}
                    {hasThinSupport(a) && (
                      <span className="ml-2 text-[10px] text-accent">thin data</span>
                    )}
                  </td>
                  <td className="py-2 mono">
                    {p.median_days == null ? "—" : fmtMonths(daysToMonths(p.median_days))}
                  </td>
                  <td className="py-2 mono">
                    {p.prob_issued_180d == null ? "—" : fmtPct(p.prob_issued_180d)}
                  </td>
                  <td className="py-2 mono">
                    {p.prob_issued_365d == null ? "—" : fmtPct(p.prob_issued_365d)}
                  </td>
                  <td className="py-2 mono">
                    {p.permit_fee_usd == null ? "—" : fmtUSDExact(p.permit_fee_usd)}
                    {p.owes_dif && <span className="ml-1.5 text-[10px] text-accent">+DIF</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-dim">
        {modelInfo.disclaimer} Permit fee is a floor — building permit only. It excludes
        Development Impact Fees, school fees, water and sewer capacity charges, and
        inclusionary housing, which together often exceed the permit itself.
      </p>
    </section>
  );
}
