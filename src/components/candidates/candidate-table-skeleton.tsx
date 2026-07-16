/**
 * Table skeleton shown inside the Suspense boundary while the row query is in
 * flight. Static — no client JS. Sized to match the real table so layout
 * doesn't shift when data arrives.
 */
export function CandidateTableSkeleton({ pageSize = 10 }: { pageSize?: number }) {
  const rowCount = Math.min(pageSize, 10);
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="h-3.5 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-secondary" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
        <div className="border-b border-border bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="h-3 w-24 rounded bg-secondary/70" />
            <div className="h-3 w-16 rounded bg-secondary/70" />
            <div className="h-3 w-20 rounded bg-secondary/70" />
            <div className="h-3 w-24 rounded bg-secondary/70" />
            <div className="h-3 w-24 rounded bg-secondary/70" />
          </div>
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: rowCount }).map((_, i) => (
            <li key={i} className="flex h-14 items-center gap-4 px-4">
              <div className="h-4 w-4 animate-pulse rounded bg-secondary" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
              <div className="h-3.5 w-32 animate-pulse rounded bg-secondary/80" />
              <div className="ml-6 h-3 w-8 animate-pulse rounded bg-secondary/80" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-secondary/80" />
              <div className="ml-auto h-3 w-40 animate-pulse rounded bg-secondary/80" />
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 animate-pulse rounded bg-secondary" />
            <div className="h-8 w-24 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </div>
    </>
  );
}
