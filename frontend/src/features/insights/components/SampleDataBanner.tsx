/**
 * Sticky, non-dismissible. Sample data rendering silently as if it were real
 * is the one failure this whole fallback could cause, so the label has to be
 * impossible to scroll past or miss on a projector.
 */
export function SampleDataBanner({ reason }: { reason: string }) {
  return (
    <div className="sticky top-0 z-30 -mx-6 mb-2 border-y-2 border-accent bg-accent/15 px-6 py-2.5 backdrop-blur lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
          Sample data
        </span>
        <span className="text-sm text-text">
          Every number on this page is invented. The server could not be reached.
        </span>
        <span className="mono text-[11px] text-muted">{reason}</span>
      </div>
    </div>
  );
}
