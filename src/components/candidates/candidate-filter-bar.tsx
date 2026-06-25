"use client";
import { Download, SlidersHorizontal, Archive, Search, ChevronDown } from "lucide-react";

interface Props {
  stages: { id: string; name: string }[];
}

export function CandidateFilterBar({ stages }: Props) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Stage" options={stages.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect label="Source" options={[
          { value: "linkedin",    label: "LinkedIn" },
          { value: "indeed",      label: "Indeed" },
          { value: "naukri",      label: "Naukri" },
          { value: "career_site", label: "Career site" },
          { value: "referral",    label: "Referral" }
        ]} />
        <FilterSelect label="Tags" options={[]} />

        <label className="relative ml-auto flex h-9 w-full max-w-md min-w-[200px] flex-1 items-center rounded-md border border-input bg-white px-3 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search by name, email or phone"
            className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </label>

        <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-xs text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" /> More filters
        </button>
        <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-xs text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground">
          <Archive className="h-3.5 w-3.5" /> Archive
        </button>
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-white text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Download">
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FilterSelect({ label, options }: { label: string; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        defaultValue=""
        className="h-9 appearance-none rounded-md border border-input bg-white pl-3 pr-8 text-xs text-foreground/80 transition-colors hover:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="" disabled hidden>{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
