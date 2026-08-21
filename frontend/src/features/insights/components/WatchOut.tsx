import type { ModelInfo, ParcelContext } from "../types";

const COASTAL_ZONE_COPY: Record<string, string> = {
  "CST-APP": "appealable to the Coastal Commission",
  "N-APP-1": "non-appealable",
  "N-APP-2": "non-appealable",
  "CST-PMT": "Commission retains permit authority",
  "DEF-CER": "deferred certification",
  CSTZB: "coastal zone boundary",
};

type Item = { severity: "high" | "note"; text: React.ReactNode };

/**
 * One place for everything that weakens a number on this page. Scattering
 * caveats next to each figure means a reader can miss the one that matters;
 * collecting them means they can't.
 */
export function WatchOut({
  parcel,
  modelInfo,
}: {
  parcel: ParcelContext;
  modelInfo: ModelInfo;
}) {
  const items: Item[] = [];

  if (parcel.coastal_deferred_certification) {
    items.push({
      severity: "high",
      text: (
        <>
          <strong>No certified Local Coastal Program.</strong> The Coastal Commission permits
          here, not the City — by-right capacity is a materially weaker claim, and the timing
          model was trained on City permits.
        </>
      ),
    });
  } else if (parcel.in_coastal_overlay) {
    items.push({
      severity: "note",
      text: (
        <>
          In the Coastal Overlay
          {parcel.coastal_zone && (
            <>
              {" "}
              (<span className="mono">{parcel.coastal_zone}</span>
              {COASTAL_ZONE_COPY[parcel.coastal_zone] && ` — ${COASTAL_ZONE_COPY[parcel.coastal_zone]}`})
            </>
          )}
          . The 2025 ADU bonus amendments are not confirmed certified there.
        </>
      ),
    });
  }

  // Thin-support and C-index now sit in the hero, next to the number they
  // qualify. Repeating them here turned six caveats into noise.

  items.push({
    severity: "note",
    text: (
      <>
        Much of what drives permit timing — staff capacity, plan quality, revision cycles — is
        not in the data.
      </>
    ),
  });

  items.push({
    severity: "note",
    text: (
      <>
        Capacity is a screening estimate. It ignores FAR, height, setbacks and parking, and
        cannot see historic districts, fire hazard zones or tenancy history.{" "}
        <strong>Real capacity is generally lower.</strong>
      </>
    ),
  });

  return (
    <section className="rounded-lg border border-edge bg-panel p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm uppercase tracking-wider text-muted">Watch out</h2>
        <span className="mono text-sm text-dim">as of {modelInfo.predictions_as_of}</span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {items.map((item, i) => (
          <li
            key={i}
            className={`rounded border p-2.5 text-sm leading-relaxed ${
              item.severity === "high"
                ? "border-accent/50 bg-accent/5"
                : "border-edge bg-ink/30 text-muted"
            }`}
          >
            {item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
