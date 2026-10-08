/**
 * Nested probability bar: filled to P(issued by 180d), then to P(by 365d).
 *
 * A bare median overclaims against a C-index of 0.612. The dataset also has
 * no p75/p90 - 29% of permits are still censored, so the survival curves
 * plateau and high quantiles are undefined for nearly every parcel. Horizon
 * probabilities are what the data actually supports.
 */
export function ProbabilityStrip({
  p180,
  p365,
}: {
  p180: number | null;
  p365: number | null;
}) {
  if (p180 == null && p365 == null) {
    return <p className="text-xs text-ink-2">No issuance probabilities for this parcel.</p>;
  }

  const a = Math.max(0, Math.min(1, p180 ?? 0));
  const b = Math.max(a, Math.min(1, p365 ?? a));

  return (
    <div className="space-y-1.5">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-wash">
        <div
          className="absolute inset-y-0 left-0 bg-ink/30"
          style={{ width: `${b * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-ink"
          style={{ width: `${a * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        {p180 != null && (
          <span>
            <span className="mono text-ink">{Math.round(a * 100)}%</span> issued by 6 mo
          </span>
        )}
        {p365 != null && (
          <span>
            <span className="mono text-ink">{Math.round(b * 100)}%</span> by 1 yr
          </span>
        )}
      </div>
    </div>
  );
}
