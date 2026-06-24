import Link from "next/link";
import { notFound } from "next/navigation";
import { Briefcase, MapPin, Calendar, Users, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteJobButton } from "@/components/jobs/delete-job-button";
import { JobDetailTabs, type JobDetailTab } from "@/components/jobs/job-detail-tabs";
import { JobDashboardTab } from "@/components/jobs/tabs/dashboard-tab";
import { JobCandidatesTab } from "@/components/jobs/tabs/candidates-tab";
import { JobDescriptionTab } from "@/components/jobs/tabs/description-tab";
import type { CandidateRow } from "@/components/candidates/candidate-table";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ALLOWED_TABS: JobDetailTab[] = ["dashboard", "candidates", "description"];

export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; stage?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const activeTab: JobDetailTab = (ALLOWED_TABS as string[]).includes(sp.tab ?? "")
    ? (sp.tab as JobDetailTab)
    : "dashboard";
  const stageFilter = sp.stage ?? null;

  const supabase = await createClient();

  // Fetch in parallel — same set whichever tab is active so navigation between
  // tabs is fast (Next caches the shared data).
  const [
    { data: job },
    { data: funnel },
    { data: team },
    { data: applications },
    { count: upcomingInterviewsCount }
  ] = await Promise.all([
    supabase.from("v_jobs_with_counts").select("*").eq("id", id).single(),
    supabase.rpc("job_funnel", { p_job_id: id }),
    supabase
      .from("job_team")
      .select("user_id, role_on_job, user:profiles(first_name, last_name, email)")
      .eq("job_id", id),
    supabase
      .from("applications")
      .select(`
        id, applied_at, updated_at,
        candidate:candidates!inner ( id, first_name, last_name, email, phone, source, preferred_location, current_company, gender, experience_years, experience_months ),
        stage:stages ( id, name )
      `)
      .eq("job_id", id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(500),
    // Count upcoming interviews for any application of this job
    supabase
      .from("interviews")
      .select("id, application:applications!inner(job_id)", { count: "exact", head: true })
      .eq("application.job_id", id)
      .gte("scheduled_start", new Date().toISOString())
      .eq("status", "scheduled")
  ]);

  if (!job) return notFound();

  // Build candidate rows for this job
  const allRows: CandidateRow[] = (applications ?? []).map((a: any) => ({
    application_id: a.id,
    candidate_id: a.candidate?.id ?? "",
    first_name: a.candidate?.first_name ?? "",
    last_name: a.candidate?.last_name ?? null,
    job_title: (job as { title: string }).title,
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

  // Apply stage filter for the Candidates tab
  const filteredRows = stageFilter
    ? allRows.filter((r) => (applications ?? []).find((a: any) => a.id === r.application_id)?.stage?.id === stageFilter)
    : allRows;

  const funnelRows = (funnel ?? []) as { stage_id: string; stage_name: string; stage_order: number; count: number }[];

  return (
    <div className="container max-w-7xl py-5 sm:py-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{job.department_name ?? "—"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold">{job.title}</h1>
            {job.confidential && <Badge variant="confidential">CONFIDENTIAL</Badge>}
            {job.priority && <Badge variant="priority">PRIORITY</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{formatEmploymentType(job.employment_type ?? "full_time")}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location_name ?? "Remote"}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job.hires}/{job.openings} hires</span>
            {job.target_close_date && (
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Closes {formatDate(job.target_close_date)}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/jobs/${id}/edit`}><Pencil className="mr-1 h-4 w-4" /> Edit</Link>
          </Button>
          <DeleteJobButton jobId={id} jobTitle={job.title} />
        </div>
      </div>

      {/* TABS NAV */}
      <div className="mt-5">
        <JobDetailTabs jobId={id} active={activeTab} />
      </div>

      {/* TAB CONTENT */}
      <div className="mt-5">
        {activeTab === "dashboard" && (
          <JobDashboardTab
            jobId={id}
            job={{
              title: job.title,
              description: job.description,
              openings: job.openings,
              hires: job.hires,
              target_close_date: job.target_close_date,
              created_at: job.created_at
            }}
            funnel={funnelRows}
            team={(team ?? []) as never}
            upcomingInterviews={upcomingInterviewsCount ?? 0}
          />
        )}

        {activeTab === "candidates" && (
          <JobCandidatesTab
            jobId={id}
            rows={filteredRows}
            funnel={funnelRows}
            activeStageId={stageFilter}
          />
        )}

        {activeTab === "description" && (
          <JobDescriptionTab jobId={id} job={job as never} />
        )}
      </div>
    </div>
  );
}

function formatEmploymentType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
