/**
 * Sticky, non-dismissible. Sample data rendering silently as if it were real
 * is the one failure this whole fallback could cause, so the label has to be
 * impossible to scroll past or miss on a projector.
 */
export function SampleDataBanner({ reason }: { reason: string }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-2 border-y-2 border-caution bg-caution-bg/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="mono rounded-full bg-caution px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-card">
          Sample data
        </span>
        <span className="text-sm font-medium text-ink">
          Every number on this page is invented. The server could not be reached.
        </span>
        <span className="mono text-sm text-ink-2">{reason}</span>
      </div>
    </div>
  );
}
