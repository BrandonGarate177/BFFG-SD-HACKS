import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiUnavailable } from "../../shared/api/client";
import { API_BASE } from "../../shared/config";
import { archetypeForUnits, type Archetype } from "../../shared/domain/archetype";
import { fetchParcelDetail } from "./lib/api";
import { CapacityPanel } from "./components/CapacityPanel";
import { HeroAnswer } from "./components/HeroAnswer";
import { ParcelFacts } from "./components/ParcelFacts";
import { ParcelFinder } from "./components/ParcelFinder";
import { RagPanel } from "./components/RagPanel";
import { WatchOut } from "./components/WatchOut";
import type { ParcelDetail } from "./types";

export function InsightsPage() {
  const { apn } = useParams();
  const [params] = useSearchParams();
  const [detail, setDetail] = useState<ParcelDetail | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [archetype, setArchetype] = useState<Archetype | null>(null);

  /** Carried from the map's cost slider. Absent when reached directly. */
  const hardCostPerUnit = useMemo(() => {
    const raw = params.get("hardCost");
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  useEffect(() => {
    if (!apn) {
      setDetail(null);
      setUnavailable(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setUnavailable(null);
    setArchetype(null);
    setLoading(true);

    fetchParcelDetail(apn)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: unknown) => {
        if (!cancelled) setUnavailable(e instanceof ApiUnavailable ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [apn]);

  // Default to the project the parcel's own capacity implies - the same rule
  // the map used to pick which prediction it filtered on, so arriving here
  // shows the number the user was already looking at.
  const selected: Archetype =
    archetype ??
    (detail?.capacity.delta_units != null
      ? archetypeForUnits(detail.capacity.delta_units)
      : "adu");

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-muted hover:text-text">
          &larr; Map
        </Link>
        {apn && <span className="mono text-sm text-accent">{apn}</span>}
        {detail?.parcel.situs_community && (
          <span className="text-sm text-muted">
            {detail.parcel.situs_community}
            {detail.parcel.situs_zip ? ` · ${detail.parcel.situs_zip}` : ""}
          </span>
        )}
        {detail?.parcel.zone && (
          <span className="mono ml-auto text-sm text-muted">{detail.parcel.zone}</span>
        )}
      </div>

      {!detail && <ParcelFinder />}

      {loading && <p className="text-sm text-dim">Loading…</p>}

      {unavailable && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 space-y-2">
          <div className="text-sm font-medium text-accent">No detail for this APN</div>
          <p className="text-xs leading-relaxed text-muted">{unavailable}</p>
          <p className="text-xs leading-relaxed text-dim">
            Coverage is the City of San Diego only — 393,755 of the county's ~1.09M parcels. The
            map is also running on generated geometry, so APNs reached by clicking it are
            synthetic and will not resolve. Search above for a real one, or check the server at{" "}
            <code className="mono">{API_BASE}</code>.
          </p>
        </div>
      )}

      {detail && (
        <>
          <HeroAnswer
            archetype={selected}
            onArchetype={setArchetype}
            prediction={detail.predictions[selected]}
            capacity={detail.capacity}
            hardCostPerUnit={hardCostPerUnit}
          />

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <CapacityPanel capacity={detail.capacity} />
              <WatchOut
                parcel={detail.parcel}
                modelInfo={detail.model_info}
                archetype={selected}
              />
              <ParcelFacts parcel={detail.parcel} />
            </div>

            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-6">
                <RagPanel rag={detail.rag_result} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
