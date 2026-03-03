export default function PedidosLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex gap-4 border-b border-border bg-muted/50 px-4 py-3">
          {[120, 80, 160, 60, 70, 80].map((w, i) => (
            <div key={i} className={`h-4 animate-pulse rounded bg-muted`} style={{ width: w }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
            {[120, 80, 160, 60, 70, 80].map((w, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-muted" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
