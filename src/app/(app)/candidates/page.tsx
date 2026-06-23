import { Plus, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CandidatesSidebar } from "@/components/candidates/sidebar";
import { CandidateFilterBar } from "@/components/candidates/candidate-filter-bar";
import { CandidateTable, type CandidateRow } from "@/components/candidates/candidate-table";
import { AddCandidateButton } from "@/components/candidates/add-candidate-button";

export const dynamic = "force-dynamic";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ view?: string; job?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const view = params.view ?? "my";

  let appQuery = supabase
    .from("applications")
    .select(`
      id,
      applied_at,
      updated_at,
      candidate:candidates ( id, first_name, last_name, email, phone, source, preferred_location, current_company, gender, experience_years, experience_months, owner_id ),
      job:jobs ( id, title ),
      stage:stages ( id, name )
    `)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (view === "archived") appQuery = appQuery.eq("is_archived", true);
  else appQuery = appQuery.eq("is_archived", false);

  if (params.job) appQuery = appQuery.eq("job_id", params.job);
  if (view === "my" && user) appQuery = appQuery.eq("candidate.owner_id", user.id);

  const [{ data: applications }, { data: jobs }, { data: stages }] = await Promise.all([
    appQuery,
    supabase.from("v_jobs_with_counts").select("id, title, candidate_count").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("stages").select("id, name").eq("is_archived", false).order("order")
  ]);

  const rows: CandidateRow[] = (applications ?? []).map((a: any) => ({
    application_id: a.id,
    candidate_id: a.candidate?.id ?? "",
    first_name: a.candidate?.first_name ?? "",
    last_name: a.candidate?.last_name ?? null,
    job_title: a.job?.title ?? null,
    stage_name: a.stage?.name ?? null,
    experience_years: a.candidate?.experience_years ?? null,
    experience_months: a.candidate?.experience_months ?? null,
    applied_at: a.applied_at,
    updated_at: a.updated_at,
    source: a.candidate?.source ?? null,
    email: a.candidate?.email ?? null,
    phone: a.candidate?.phone ?? null,
    preferred_location: a.candidate?.preferred_location ?? null,
    current_company: a.candidate?.current_company ?? null,
    gender: a.candidate?.gender ?? null
  }));

  return (
    <div className="flex">
      <CandidatesSidebar
        activeJobs={(jobs ?? []).map((j: any) => ({ id: j.id, title: j.title, candidate_count: j.candidate_count }))}
        counts={{ my: rows.length, upcomingInterviews: 0, pendingFeedback: 0 }}
      />

      <div className="flex-1 px-6 py-5">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {view === "my" && "My candidates"}
              {view === "all" && "All candidates"}
              {view === "talent_pool" && "Talent pool"}
              {view === "archived" && "Archived candidates"}
              {view === "duplicates" && "Duplicates"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">You can access active candidates across all your jobs from here.</p>
          </div>
          <AddCandidateButton
            jobs={(jobs ?? []).map((j: any) => ({ id: j.id, title: j.title }))}
            stages={(stages ?? []) as never}
          />
        </header>

        <div className="mt-5">
          <CandidateFilterBar stages={(stages ?? []) as never} />
        </div>

        <div className="mt-4">
          <CandidateTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
