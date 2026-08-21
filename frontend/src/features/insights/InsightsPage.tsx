import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiUnavailable } from "../../shared/api/client";
import { API_BASE } from "../../shared/config";
import { fetchParcelDetail } from "./lib/api";
import { CapacityPanel } from "./components/CapacityPanel";
import { ParcelFacts } from "./components/ParcelFacts";
import { ParcelFinder } from "./components/ParcelFinder";
import { PredictionPanel } from "./components/PredictionPanel";
import { RagPanel } from "./components/RagPanel";
import type { ParcelDetail } from "./types";

export function InsightsPage() {
  const { apn } = useParams();
  const [detail, setDetail] = useState<ParcelDetail | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apn) {
      setDetail(null);
      setUnavailable(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setUnavailable(null);
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

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-10 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="text-sm text-muted hover:text-text">
          &larr; Map
        </Link>
        {apn && <span className="mono text-sm text-accent">{apn}</span>}
        {detail?.parcel.situs_community && (
          <span className="text-sm text-muted">{detail.parcel.situs_community}</span>
        )}
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">
        {detail?.parcel.zone ?? (apn ? "Parcel" : "Parcel insights")}
      </h1>

      <ParcelFinder compact={Boolean(detail)} />

      {loading && <p className="text-sm text-dim">Loading…</p>}

      {unavailable && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 space-y-2">
          <div className="text-sm font-medium text-accent">No detail for this APN</div>
          <p className="text-xs leading-relaxed text-muted">{unavailable}</p>
          <p className="text-xs leading-relaxed text-dim">
            Coverage is the City of San Diego only — 393,755 of the county's ~1.09M parcels.
            The map is also running on generated geometry right now, so APNs reached by
            clicking it are synthetic and will not resolve. Search above for a real one, or
            check that the server is up at <code className="mono">{API_BASE}</code>.
          </p>
        </div>
      )}

      {detail && (
        <div className="space-y-6">
          <PredictionPanel predictions={detail.predictions} modelInfo={detail.model_info} />
          <CapacityPanel capacity={detail.capacity} />
          <ParcelFacts parcel={detail.parcel} />
          <RagPanel rag={detail.rag_result} />
        </div>
      )}
    </div>
  );
}
