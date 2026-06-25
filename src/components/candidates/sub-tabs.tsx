"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "my",          label: "My Candidates",  href: "/candidates" },
  { id: "all",         label: "All Candidates", href: "/candidates?view=all" },
  { id: "talent_pool", label: "Talent Pool",    href: "/candidates?view=talent_pool" },
  { id: "archived",    label: "Archived",       href: "/candidates?view=archived" },
  { id: "duplicates",  label: "Duplicates",     href: "/candidates?view=duplicates" }
] as const;

export function CandidatesSubTabs() {
  const search = useSearchParams();
  const active = search.get("view") ?? "my";

  return (
    <div className="border-b border-border bg-white">
      <ul className="-mx-1 flex items-center gap-1 overflow-x-auto px-3 sm:px-5">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                className={cn(
                  "relative inline-flex h-11 items-center whitespace-nowrap px-3 text-xs font-medium uppercase tracking-wide transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {isActive && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
