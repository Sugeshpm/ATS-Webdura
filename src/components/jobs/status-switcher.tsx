"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

const STATUSES = [
  { value: "active",   label: "Active Jobs" },
  { value: "all",      label: "All Jobs" },
  { value: "draft",    label: "Drafts" },
  { value: "archived", label: "Archived" },
  { value: "closed",   label: "Closed" }
] as const;

export function JobStatusSwitcher({ count }: { count: number }) {
  const router = useRouter();
  const search = useSearchParams();
  const current = search.get("status") ?? "active";

  function go(value: string) {
    const next = new URLSearchParams(search.toString());
    if (value === "active") next.delete("status"); else next.set("status", value);
    router.push(`/jobs${next.toString() ? `?${next}` : ""}`);
  }

  const label = STATUSES.find((s) => s.value === current)?.label ?? "Jobs";

  return (
    <div className="relative inline-flex items-center gap-2">
      <h1 className="text-xl font-semibold">
        {label} <span className="text-muted-foreground">({count})</span>
      </h1>
      <select
        value={current}
        onChange={(e) => go(e.target.value)}
        aria-label="Switch status filter"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
