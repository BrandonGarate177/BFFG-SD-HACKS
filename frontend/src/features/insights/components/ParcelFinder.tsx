import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ARCHETYPE_LABEL, ARCHETYPES, type Archetype } from "../../../shared/domain/archetype";
import { ApiUnavailable } from "../../../shared/api/client";
import { daysToMonths, fmtMonths, fmtUSDExact } from "../../../shared/format";
import { searchParcels } from "../lib/api";
import type { ParcelMatch } from "../types";

/**
 * Finds a real apn to inspect, via POST /search.
 *
 * The map is the intended way in, but its parcels are currently generated
 * with synthetic apns that 404 against /parcel-detail. This keeps the
 * Insights feature demoable on its own, and it stays useful afterwards as a
 * direct lookup.
 *
 * NOTE budget here is `permit_fee_usd` — a fee floor in the thousands, not
 * the map's construction-cost estimate in the hundreds of thousands. The
 * two sliders are deliberately different quantities.
 */
export function ParcelFinder({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [archetype, setArchetype] = useState<Archetype>("adu");
  // One flat fee per archetype in the dataset (adu 7,634 · duplex 17,236 ·
  // 3-4 unit 7,507 · 5+ 11,857), so this is effectively a per-archetype
  // on/off switch rather than a filter. Default clears all four.
  const [feeCap, setFeeCap] = useState(20_000);
  const [months, setMonths] = useState(24);
  const [community, setCommunity] = useState("");
  const [apn, setApn] = useState("");
  const [matches, setMatches] = useState<ParcelMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await searchParcels({
        archetype,
        budget_usd: feeCap,
        timeframe_months: months,
        community: community.trim() || undefined,
        limit: 25,
      });
      setMatches(res.matches);
    } catch (e) {
      setError(e instanceof ApiUnavailable ? e.message : String(e));
      setMatches(null);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded border border-edge bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <section className="rounded-lg border border-edge bg-panel p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted">Find a parcel</h2>
        {!compact && <span className="text-[11px] text-dim">393,755 City of San Diego parcels</span>}
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (apn.trim()) navigate(`/parcel/${apn.trim()}`);
        }}
      >
        <input
          className={`${field} flex-1 min-w-40 mono`}
          placeholder="APN, e.g. 2392600700"
          value={apn}
          onChange={(e) => setApn(e.target.value)}
        />
        <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-ink">
          Open
        </button>
      </form>

      {!compact && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-dim">Project</span>
              <select className={field} value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype)}>
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>{ARCHETYPE_LABEL[a]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-dim">Max permit fee</span>
              <input className={field} type="number" min={0} step={1000} value={feeCap}
                     onChange={(e) => setFeeCap(Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-dim">Within (months)</span>
              <input className={field} type="number" min={1} max={60} value={months}
                     onChange={(e) => setMonths(Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-dim">Jurisdiction</span>
              <input className={field} placeholder="any" value={community}
                     onChange={(e) => setCommunity(e.target.value)} />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={busy}
              className="rounded border border-edge px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
            >
              {busy ? "Searching…" : "Search"}
            </button>
            <span className="text-[11px] text-dim">
              Permit fee is one flat value per project size, so this cap admits either every
              parcel of that size or none — it does not rank them. Timing is what discriminates.
            </span>
          </div>
        </>
      )}

      {error && (
        <p className="rounded border border-accent/40 bg-accent/5 p-2.5 text-[11px] leading-relaxed">
          {error}
        </p>
      )}

      {matches && matches.length === 0 && (
        <p className="text-sm text-dim">No parcels match. Try a higher fee cap or longer window.</p>
      )}

      {matches && matches.length > 0 && (
        <ul className="divide-y divide-edge/60 rounded border border-edge">
          {matches.map((m) => (
            <li key={m.apn}>
              <button
                onClick={() => navigate(`/parcel/${m.apn}`)}
                className="flex w-full items-baseline justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-ink/40"
              >
                <span className="mono text-accent">{m.apn}</span>
                <span className="flex gap-4 text-xs text-muted">
                  <span className="mono text-text">{fmtMonths(daysToMonths(m.median_days))}</span>
                  {m.prob_issued_365d != null && (
                    <span className="mono">{Math.round(m.prob_issued_365d * 100)}% / 1yr</span>
                  )}
                  <span className="mono text-dim">{fmtUSDExact(m.permit_fee_usd)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
