import { Skeleton } from "@/components/ui/skeleton";

export default function CandidatesLoading() {
  return (
    <div className="flex min-h-[calc(100vh-6rem)]">
      {/* Sidebar skeleton */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-white md:block">
        <div className="space-y-1.5 px-3 pt-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="mt-5 border-t border-border px-3 pt-4">
          <Skeleton className="mb-3 h-3 w-28" />
          <Skeleton className="mb-3 h-8 w-full" />
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-full" />)}
          </div>
        </div>
      </aside>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3 w-80" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-5 rounded-xl border border-border bg-white p-3 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 flex-1 min-w-[200px]" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white shadow-card">
          <div className="border-b border-border bg-surface-sunken px-4 py-3">
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="divide-y divide-border">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-4 h-4 w-24" />
                <Skeleton className="ml-4 h-5 w-20 rounded-md" />
                <Skeleton className="ml-4 h-5 w-16 rounded-md" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
