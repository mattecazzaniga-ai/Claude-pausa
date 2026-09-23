/** Placeholder rows shaped like the card list they precede, instead of a generic spinner. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-4">
          <div className="h-4 w-1/3 rounded bg-surface-2" />
          <div className="mt-2.5 h-3 w-1/2 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
