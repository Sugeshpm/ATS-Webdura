import Link from "next/link";
import { LayoutGrid, List, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { JobFilterBar } from "@/components/jobs/job-filter-bar";
import { JobsGrid } from "@/components/jobs/jobs-grid";
import { JobStatusSwitcher } from "@/components/jobs/status-switcher";
import { JobPriorityToggle } from "@/components/jobs/priority-toggle";
import { BulkActions } from "@/components/shared/bulk-actions";

export const dynamic = "force-dynamic";

type JobsSearchParams = {
  priority?: string; status?: string; q?: string;
  department?: string; business_unit?: string; location?: string;
  recruiter?: string; hiring_manager?: string;
};

export default async function JobsPage({ searchParams }: { searchParams: Promise<JobsSearchParams> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const status = params.status ?? "active";

  // Recruiter / hiring-manager filters resolve to a set of job ids via job_team.
  let teamJobIds: string[] | null = null;
  const teamUserFilters = [params.recruiter, params.hiring_manager].filter(Boolean) as string[];
  if (teamUserFilters.length) {
    const idSets = await Promise.all(
      teamUserFilters.map(async (uid) => {
        const { data } = await supabase.from("job_team").select("job_id").eq("user_id", uid);
        return new Set(((data ?? []) as { job_id: string }[]).map((r) => r.job_id));
      })
    );
    // Intersect: a job must include every selected team member.
    teamJobIds = [...idSets[0]].filter((id) => idSets.every((s) => s.has(id)));
    if (teamJobIds.length === 0) teamJobIds = ["00000000-0000-0000-0000-000000000000"]; // no match sentinel
  }

  let query = supabase
    .from("v_jobs_with_counts")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") query = query.eq("status", status);
  if (params.priority === "1") query = query.eq("priority", true);
  if (params.department) query = query.eq("department_id", params.department);
  if (params.business_unit) query = query.eq("business_unit_id", params.business_unit);
  if (params.location) query = query.eq("location_id", params.location);
  if (teamJobIds) query = query.in("id", teamJobIds);
  const jobSearch = (params.q ?? "").replace(/[,()%*\\]/g, " ").trim();
  if (jobSearch) query = query.ilike("title", `%${jobSearch}%`);

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
          <JobStatusSwitcher count={jobs?.length ?? 0} />
          <p className="mt-1 text-xs text-muted-foreground">Here you can find all the jobs of this organisation.</p>
        </div>

        <div className="flex items-center gap-3">
          <JobPriorityToggle />
          <BulkActions kind="jobs" exportQuery={`?status=${status}`} />
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

      <div className="mt-6">
        <JobsGrid jobs={(jobs ?? []) as never} />
      </div>
    </div>
  );
}
