import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiUnavailable } from "../../shared/api/client";
import { API_BASE } from "../../shared/config";
import { fetchParcelDetail } from "./lib/api";
import { CapacityPanel } from "./components/CapacityPanel";
import { PredictionPanel } from "./components/PredictionPanel";
import { RagPanel } from "./components/RagPanel";
import type { ParcelDetail } from "./types";

export function InsightsPage() {
  const { apn = "" } = useParams();
  const [detail, setDetail] = useState<ParcelDetail | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setUnavailable(null);

    fetchParcelDetail(apn)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: unknown) => {
        if (!cancelled) setUnavailable(e instanceof ApiUnavailable ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [apn]);

  const parcel = detail?.parcel as Record<string, string | number | null> | undefined;

  return (
    <div className="mx-auto max-w-4xl p-6 lg:p-10 space-y-8">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm text-muted hover:text-text">
          &larr; Map
        </Link>
        <span className="mono text-sm text-accent">{apn}</span>
        {parcel?.situs_community && (
          <span className="text-sm text-muted">{String(parcel.situs_community)}</span>
        )}
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">
        {parcel?.zone ? String(parcel.zone) : "Parcel"}
      </h1>

      {unavailable && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 space-y-2">
          <div className="text-sm font-medium text-accent">Detail unavailable</div>
          <p className="text-xs leading-relaxed text-muted">{unavailable}</p>
          <p className="text-xs leading-relaxed text-dim">
            The map is currently running on generated geometry, so its APNs are not real and
            will not resolve against <code className="mono">{API_BASE}/parcel-detail</code>.
            Real APNs will work once parcel geometry lands.
          </p>
        </div>
      )}

      {detail && (
        <div className="space-y-6">
          <PredictionPanel predictions={detail.predictions} modelInfo={detail.model_info} />
          <CapacityPanel capacity={detail.capacity} />
          <RagPanel rag={detail.rag_result} />
        </div>
      )}
    </div>
  );
}
