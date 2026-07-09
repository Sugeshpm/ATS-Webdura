"use client";
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

type Option = { id: string; name: string };

interface Props {
  departments: Option[];
  businessUnits: Option[];
  locations: Option[];
  recruiters: Option[];
  hiringManagers: Option[];
}

export function JobFilterBar({ departments, businessUnits, locations, recruiters, hiringManagers }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const qParam = params.get("q") ?? "";
  const [q, setQ] = React.useState(qParam);
  React.useEffect(() => { setQ(qParam); }, [qParam]);

  const setParam = React.useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  React.useEffect(() => {
    const t = setTimeout(() => { if (q.trim() !== qParam) setParam("q", q.trim()); }, 400);
    return () => clearTimeout(t);
  }, [q, qParam, setParam]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <Filter label="Business Unit" value={params.get("business_unit") ?? ""} onChange={(v) => setParam("business_unit", v)} options={businessUnits} />
      <Filter label="Department" value={params.get("department") ?? ""} onChange={(v) => setParam("department", v)} options={departments} />
      <Filter label="Hiring Manager" value={params.get("hiring_manager") ?? ""} onChange={(v) => setParam("hiring_manager", v)} options={hiringManagers} />
      <Filter label="Recruiter" value={params.get("recruiter") ?? ""} onChange={(v) => setParam("recruiter", v)} options={recruiters} />
      <Filter label="Location" value={params.get("location") ?? ""} onChange={(v) => setParam("location", v)} options={locations} />

      <label className="relative flex items-center rounded-md border border-input bg-transparent px-3 text-sm">
        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jobs by title"
          className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="ml-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>
    </div>
  );
}

function Filter({
  label, value, onChange, options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            "h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-ring " +
            (value ? "text-foreground" : "text-muted-foreground")
          }
        >
          <option value="">{label}: All</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
      </div>
    </label>
  );
}
