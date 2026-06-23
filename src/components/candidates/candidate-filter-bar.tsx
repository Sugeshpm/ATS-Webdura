"use client";
import { Download, Archive, MoreHorizontal, Search } from "lucide-react";

interface Props {
  stages: { id: string; name: string }[];
}

export function CandidateFilterBar({ stages }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterSelect label="Stage" options={stages.map((s) => ({ value: s.id, label: s.name }))} />
      <FilterSelect label="Source" options={[{value:"linkedin",label:"Linkedin"},{value:"indeed",label:"Indeed"},{value:"naukri",label:"Naukri"},{value:"career_site",label:"Career site"},{value:"referral",label:"Referral"}]} />
      <FilterSelect label="Tags" options={[]} />

      <label className="relative flex h-9 flex-1 min-w-[200px] max-w-md items-center rounded-md border border-input px-3 text-sm">
        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
        <input placeholder="Search" className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
      </label>

      <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-secondary/30 px-3 text-xs">More <MoreHorizontal className="h-3 w-3" /></button>
      <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 text-xs"><Archive className="h-3.5 w-3.5" /> Archive</button>
      <button className="ml-auto inline-flex h-9 items-center gap-1 rounded-md border border-input bg-transparent px-3 text-xs"><Download className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function FilterSelect({ label, options }: { label: string; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        defaultValue=""
        className="h-9 appearance-none rounded-md border border-input bg-transparent px-3 pr-7 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="" disabled hidden>{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" /></svg>
    </div>
  );
}
