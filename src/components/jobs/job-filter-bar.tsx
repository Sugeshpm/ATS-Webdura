"use client";
import { Search, Filter as FilterIcon } from "lucide-react";

type Option = { id: string; name: string };

interface Props {
  departments: Option[];
  businessUnits: Option[];
  locations: Option[];
  recruiters: Option[];
  hiringManagers: Option[];
}

export function JobFilterBar({ departments, businessUnits, locations, recruiters, hiringManagers }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      <Filter label="Status">
        <option>All statuses</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
        <option value="archived">Archived</option>
        <option value="closed">Closed</option>
      </Filter>
      <Filter label="Business Unit">
        <option>All</option>
        {businessUnits.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Filter>
      <Filter label="Department">
        <option>All</option>
        {departments.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Filter>
      <Filter label="Hiring Manager">
        <option>All</option>
        {hiringManagers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Filter>
      <Filter label="Recruiter">
        <option>All</option>
        {recruiters.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Filter>
      <Filter label="Location">
        <option>All</option>
        {locations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Filter>

      <label className="relative flex items-center rounded-md border border-input bg-transparent px-3 text-sm">
        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
        <input placeholder="Search for jobs by title, department, job id" className="h-9 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
        <FilterIcon className="ml-2 h-4 w-4 text-muted-foreground" />
      </label>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div className="relative">
        <select
          defaultValue=""
          className="h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 pr-7 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="" disabled hidden>{label}</option>
          {children}
        </select>
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
      </div>
    </label>
  );
}
