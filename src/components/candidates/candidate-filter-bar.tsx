"use client";
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, ChevronDown, X } from "lucide-react";

interface Props {
  stages: { id: string; name: string }[];
}

const SOURCES = [
  { value: "linkedin",      label: "LinkedIn" },
  { value: "indeed",        label: "Indeed" },
  { value: "naukri",        label: "Naukri" },
  { value: "career_site",   label: "Career site" },
  { value: "referral",      label: "Referral" },
  { value: "meta_lead_ads", label: "Meta Lead Ads" },
  { value: "manual",        label: "Manual" }
];

export function CandidateFilterBar({ stages }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const stage = params.get("stage") ?? "";
  const source = params.get("source") ?? "";
  const qParam = params.get("q") ?? "";

  const [q, setQ] = React.useState(qParam);
  React.useEffect(() => { setQ(qParam); }, [qParam]);

  const setParam = React.useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  // Debounce the search box → ?q=
  React.useEffect(() => {
    const t = setTimeout(() => { if (q.trim() !== qParam) setParam("q", q.trim()); }, 400);
    return () => clearTimeout(t);
  }, [q, qParam, setParam]);

  const hasFilters = Boolean(stage || source || qParam);

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    next.delete("stage"); next.delete("source"); next.delete("q");
    setQ("");
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Stage"
          value={stage}
          onChange={(v) => setParam("stage", v)}
          options={stages.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          label="Source"
          value={source}
          onChange={(v) => setParam("source", v)}
          options={SOURCES}
        />

        <label className="relative ml-auto flex h-9 w-full max-w-md min-w-[200px] flex-1 items-center rounded-md border border-input bg-white px-3 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or phone"
            className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-white px-3 text-xs text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          "h-9 appearance-none rounded-md border border-input bg-white pl-3 pr-8 text-xs transition-colors hover:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring " +
          (value ? "text-foreground" : "text-foreground/80")
        }
      >
        <option value="">{label}: All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
