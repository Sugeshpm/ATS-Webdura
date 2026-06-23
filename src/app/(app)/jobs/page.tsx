import Link from "next/link";
import { ChevronDown, LayoutGrid, List, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { JobFilterBar } from "@/components/jobs/job-filter-bar";
import { JobCard } from "@/components/jobs/job-card";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ priority?: string; status?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("v_jobs_with_counts")
    .select("*")
    .order("created_at", { ascending: false });

  const status = params.status ?? "active";
  if (status !== "all") query = query.eq("status", status);
  if (params.priority === "1") query = query.eq("priority", true);

  const [{ data: jobs }, { data: departments }, { data: businessUnits }, { data: locations }, { data: recruiters }] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("business_units").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("locations").select("id, name").eq("is_archived", false).order("name"),
    supabase.from("profiles").select("id, first_name, last_name").in("role", ["recruiter", "hiring_manager", "admin"])
  ]);

  const recruiterOptions = (recruiters ?? []).map((r) => ({
    id: r.id,
    name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Unnamed"
  }));

  return (
    <div className="container py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {status === "all" ? "All Jobs" : status === "active" ? "Active Jobs" : status[0].toUpperCase() + status.slice(1) + " Jobs"}{" "}
              <span className="text-muted-foreground">({jobs?.length ?? 0})</span>
            </h1>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Here you can find all the jobs of this organisation.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch defaultChecked={params.priority === "1"} aria-label="Show only priority" />
            Show only priority
          </label>
          <div className="flex h-9 items-center rounded-md border border-input">
            <button className="flex h-9 items-center justify-center px-2 text-muted-foreground hover:text-foreground" aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></button>
            <div className="h-5 w-px bg-border" />
            <button className="flex h-9 items-center justify-center px-2 text-muted-foreground hover:text-foreground" aria-label="List view"><List className="h-4 w-4" /></button>
          </div>
          <Button asChild>
            <Link href="/jobs/new">
              <Plus className="mr-1 h-4 w-4" /> Create Job
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-5">
        <JobFilterBar
          departments={(departments ?? []) as { id: string; name: string }[]}
          businessUnits={(businessUnits ?? []) as { id: string; name: string }[]}
          locations={(locations ?? []) as { id: string; name: string }[]}
          recruiters={recruiterOptions}
          hiringManagers={recruiterOptions}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(jobs ?? []).map((j) => (
          <JobCard key={j.id} job={j as never} />
        ))}
        {(!jobs || jobs.length === 0) && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No jobs yet.{" "}
            <Link href="/jobs/new" className="text-primary hover:underline">Create your first job</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
