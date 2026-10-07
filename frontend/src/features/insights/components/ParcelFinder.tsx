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

  const field = "w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-2/70 focus:border-ink";

  return (
    <section className="space-y-4 rounded-2xl border border-rule bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl leading-none">Find a parcel</h2>
        {!compact && <span className="eyebrow">393,755 City of San Diego parcels</span>}
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
          aria-label="APN"
          placeholder="APN, e.g. 2392600700"
          value={apn}
          onChange={(e) => setApn(e.target.value)}
        />
        <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hi">
          Open
        </button>
      </form>

      {!compact && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="eyebrow block">Project</span>
              <select className={field} value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype)}>
                {ARCHETYPES.map((a) => (
                  <option key={a} value={a}>{ARCHETYPE_LABEL[a]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="eyebrow block">Max permit fee</span>
              <input className={field} type="number" min={0} step={1000} value={feeCap}
                     onChange={(e) => setFeeCap(Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="eyebrow block">Within (months)</span>
              <input className={field} type="number" min={1} max={60} value={months}
                     onChange={(e) => setMonths(Number(e.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="eyebrow block">Community</span>
              <input className={field} placeholder="e.g. SAN DIEGO" value={community}
                     onChange={(e) => setCommunity(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              onClick={run}
              disabled={busy}
              className="shrink-0 rounded-full border border-ink px-4 py-1.5 text-sm font-medium transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {busy ? "Searching…" : "Search"}
            </button>
            <span className="text-sm leading-relaxed text-ink-2">
              Permit fee is one flat value per project size, so this cap admits either every
              parcel of that size or none — it does not rank them. Timing is what discriminates.
            </span>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-md border border-caution-rule bg-caution-bg p-2.5 text-sm leading-relaxed text-ink">
          {error}
        </p>
      )}

      {matches && matches.length === 0 && (
        <p className="text-sm text-ink-2">No parcels match. Try a higher fee cap or longer window.</p>
      )}

      {matches && matches.length > 0 && (
        <ul className="divide-y divide-rule-soft overflow-hidden rounded-xl border border-rule">
          {matches.map((m) => (
            <li key={m.apn}>
              <button
                onClick={() => navigate(`/parcel/${m.apn}`)}
                className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-wash"
              >
                <span className="mono text-ink">{m.apn}</span>
                <span className="flex gap-4 text-xs text-ink-2">
                  <span className="mono text-ink">{fmtMonths(daysToMonths(m.median_days))}</span>
                  {m.prob_issued_365d != null && (
                    <span className="mono">{Math.round(m.prob_issued_365d * 100)}% / 1yr</span>
                  )}
                  <span className="mono">{fmtUSDExact(m.permit_fee_usd)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
