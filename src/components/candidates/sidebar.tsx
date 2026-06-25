"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, Info, Users, Calendar, MessageSquareQuote } from "lucide-react";
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
    { href: urlFor({ view: null }),                  label: "My candidates",       icon: Users,             count: counts?.my,                 active: view === "my" },
    { href: urlFor({ view: "upcoming_interviews" }), label: "Upcoming interviews", icon: Calendar,          count: counts?.upcomingInterviews, active: view === "upcoming_interviews" },
    { href: urlFor({ view: "pending_feedback" }),    label: "Pending feedback",    icon: MessageSquareQuote, count: counts?.pendingFeedback,    active: view === "pending_feedback", info: true }
  ];

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-white md:block">
      <div className="px-3 pt-4">
        <ul className="space-y-0.5">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.label}>
                <Link
                  href={it.href}
                  className={cn(
                    "group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    it.active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", it.active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    {it.label}
                    {it.info && <Info className="h-3 w-3 text-muted-foreground" />}
                  </span>
                  {typeof it.count === "number" && (
                    <span className={cn(
                      "rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                      it.active ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                    )}>
                      {it.count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-5 border-t border-border px-3 pt-4 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your active jobs</h3>
        </div>

        <label className="mb-3 flex items-center rounded-md border border-input bg-white px-2 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <Search className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <input placeholder="Search job" className="h-8 w-full bg-transparent text-xs focus:outline-none" />
        </label>

        <ul className="space-y-0.5">
          {activeJobs.map((j) => {
            const isActive = filterJob === j.id;
            return (
              <li key={j.id}>
                <Link
                  href={urlFor({ job: j.id })}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className="truncate">{j.title}</span>
                  <span className={cn(
                    "ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    isActive ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  )}>
                    {j.candidate_count}
                  </span>
                </Link>
              </li>
            );
          })}
          {activeJobs.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No active jobs.</li>}
        </ul>
      </div>
    </aside>
  );
}
