"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  activeJobs: { id: string; title: string; candidate_count: number }[];
  counts?: { my: number; upcomingInterviews: number; pendingFeedback: number };
}

export function CandidatesSidebar({ activeJobs, counts }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();
  const view = search.get("view") ?? "my";
  const filterJob = search.get("job");

  function urlFor(params: Record<string, string | null>) {
    const next = new URLSearchParams(search.toString());
    Object.entries(params).forEach(([k, v]) => { if (v === null) next.delete(k); else next.set(k, v); });
    return `${pathname}${next.toString() ? `?${next}` : ""}`;
  }

  const items = [
    { href: urlFor({ view: null }),                  label: "My candidates",       count: counts?.my,                active: view === "my" },
    { href: urlFor({ view: "upcoming_interviews" }), label: "Upcoming interviews", count: counts?.upcomingInterviews, active: view === "upcoming_interviews" },
    { href: urlFor({ view: "pending_feedback" }),    label: "Pending feedback",    count: counts?.pendingFeedback,    active: view === "pending_feedback", info: true }
  ];

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border md:block">
      <ul className="px-3 py-3">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-secondary/50",
                it.active && "bg-secondary text-foreground"
              )}
            >
              <span className="inline-flex items-center gap-1.5">{it.label}{it.info && <Info className="h-3 w-3 text-muted-foreground" />}</span>
              {typeof it.count === "number" && <span className="text-xs text-muted-foreground">{it.count}</span>}
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-3 py-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your Active Jobs</div>
        <label className="mb-2 flex items-center rounded-md border border-input px-2">
          <Search className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
          <input placeholder="Search job" className="h-7 w-full bg-transparent text-xs focus:outline-none" />
        </label>
        <ul className="space-y-0.5">
          {activeJobs.map((j) => (
            <li key={j.id}>
              <Link
                href={urlFor({ job: j.id })}
                className={cn(
                  "flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-secondary/50",
                  filterJob === j.id && "bg-secondary text-foreground"
                )}
              >
                <span className="truncate">{j.title}</span>
                <span className="text-muted-foreground">({j.candidate_count})</span>
              </Link>
            </li>
          ))}
          {activeJobs.length === 0 && <li className="text-xs text-muted-foreground">No active jobs.</li>}
        </ul>
      </div>
    </aside>
  );
}
