"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// Order: All Candidates first (default), then My, then the candidate-centric buckets.
const TABS = [
  { id: "all",         label: "All Candidates", countKey: "all" as const },
  { id: "my",          label: "My Candidates",  countKey: "my" as const },
  { id: "talent_pool", label: "Talent Pool",    countKey: "talent_pool" as const },
  { id: "archived",    label: "Archived",       countKey: "archived" as const },
  { id: "duplicates",  label: "Duplicates",     countKey: "duplicates" as const }
] as const;

interface Props {
  counts: { my: number; all: number; talent_pool: number; archived: number; duplicates: number };
}

/**
 * Sub-tab strip for the Candidates module. Each tab preserves the current
 * job-status filter (and every other search param) so the user's toggle
 * choice sticks while they move between My / All / Talent Pool / etc.
 */
export function CandidatesSubTabs({ counts }: Props) {
  const search = useSearchParams();
  // Default view is now "all"; omitting ?view= keeps URLs short.
  const active = search.get("view") ?? "all";

  function hrefFor(id: string) {
    const params = new URLSearchParams(search.toString());
    if (id === "all") params.delete("view");     // "all" is the default — no need to spell it out
    else params.set("view", id);
    // Job filter belongs to the *active* status; drop it on tab switch so a
    // stale filter doesn't accidentally hide candidates in the new view.
    params.delete("job");
    // Pagination is tab-local — a page number from the previous tab has no meaning here.
    params.delete("page");
    const qs = params.toString();
    return `/candidates${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="border-b border-border bg-white">
      <ul className="-mx-1 flex items-center gap-1 overflow-x-auto px-3 sm:px-5">
        {TABS.map((t) => {
          const isActive = t.id === active;
          const count = counts[t.countKey];
          return (
            <li key={t.id}>
              <Link
                href={hrefFor(t.id)}
                className={cn(
                  "relative inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-medium uppercase tracking-wide transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                <span className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                )}>
                  {count}
                </span>
                {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
