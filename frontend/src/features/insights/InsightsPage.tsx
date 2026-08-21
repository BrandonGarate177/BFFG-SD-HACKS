import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiUnavailable } from "../../shared/api/client";
import { API_BASE } from "../../shared/config";
import { archetypeForUnits, type Archetype } from "../../shared/domain/archetype";
import { fetchParcelDetail, fetchParcelRag } from "./lib/api";
import { SAMPLE_PARCEL_DETAIL } from "./lib/fixture";
import { CapacityPanel } from "./components/CapacityPanel";
import { HeroAnswer } from "./components/HeroAnswer";
import { ParcelFacts } from "./components/ParcelFacts";
import { ParcelFinder } from "./components/ParcelFinder";
import { ChatRail } from "./components/ChatRail";
import { SampleDataBanner } from "./components/SampleDataBanner";
import { WatchOut } from "./components/WatchOut";
import type { ParcelDetail, RagResult } from "./types";

export function InsightsPage() {
  const { apn } = useParams();
  const [params] = useSearchParams();
  const [detail, setDetail] = useState<ParcelDetail | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  /** Non-null when `detail` is the fixture rather than a real response. */
  const [sampleReason, setSampleReason] = useState<string | null>(null);
  /**
   * The parcel narrative, fetched separately from the detail. Null means
   * still in flight - the rail shows a pending turn rather than the page
   * withholding every number until Claude answers.
   */
  const [rag, setRag] = useState<RagResult | null>(null);
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
      setRag(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setUnavailable(null);
    setSampleReason(null);
    setArchetype(null);
    setRag(null);
    setLoading(true);

    fetchParcelDetail(apn)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);

        // Only now, and deliberately not in parallel: on the failure path
        // below we fall back to the fixture's own narrative, and a second
        // in-flight request would race it. The detail resolves in under a
        // millisecond, so chaining costs nothing and skips a guaranteed 404
        // for an apn outside the dataset.
        fetchParcelRag(apn)
          .then((r) => {
            if (!cancelled) setRag(r);
          })
          .catch((e: unknown) => {
            if (cancelled) return;
            // Resolve the pending turn into a visible failure. Leaving it
            // null would spin the rail forever.
            setRag({
              reasons: [],
              sentiment_summary: "Could not load the assistant's read on this parcel.",
              source: "error",
              error: e instanceof ApiUnavailable ? e.message : String(e),
            });
          });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof ApiUnavailable ? e.message : String(e);
        setUnavailable(msg);
        // A 404 means the apn genuinely is not in the dataset - showing
        // sample numbers under it would imply the parcel exists. Only fall
        // back when the server itself is unreachable.
        if (!msg.startsWith("Not found")) {
          setDetail({ ...SAMPLE_PARCEL_DETAIL, apn });
          setSampleReason(msg);
          // The fixture carries its own narrative. Without this the rail
          // would sit pending forever, since /parcel-rag is unreachable too.
          setRag(SAMPLE_PARCEL_DETAIL.rag_result ?? null);
        }
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

      {sampleReason && <SampleDataBanner reason={sampleReason} />}

      {!detail && !loading && <ParcelFinder />}

      {loading && <p className="text-sm text-dim">Loading…</p>}

      {unavailable && !sampleReason && (
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
            parcel={detail.parcel}
            hardCostPerUnit={hardCostPerUnit}
          />

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <CapacityPanel capacity={detail.capacity} />
              <WatchOut parcel={detail.parcel} modelInfo={detail.model_info} />
              <ParcelFacts parcel={detail.parcel} />
            </div>

            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-6">
                <ChatRail
                  detail={detail}
                  rag={rag}
                  archetype={selected}
                  disabled={Boolean(sampleReason)}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
