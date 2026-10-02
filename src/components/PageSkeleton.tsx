/** Placeholder shown the instant a dashboard page is opened, while its data loads. */
export function PageSkeleton() {
  return (
    <div data-loading-skeleton className="animate-pulse space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded bg-border" />
        <div className="h-7 w-56 rounded-lg bg-border" />
        <div className="h-4 w-full max-w-md rounded bg-border/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-surface" />
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-border bg-surface" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-40 rounded-2xl border border-border bg-surface" />
        <div className="h-40 rounded-2xl border border-border bg-surface" />
      </div>
    </div>
  );
}
