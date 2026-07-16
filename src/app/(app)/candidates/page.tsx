import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CandidatesSidebar } from "@/components/candidates/sidebar";
import { CandidatesSubTabs } from "@/components/candidates/sub-tabs";
import { CandidateFilterBar } from "@/components/candidates/candidate-filter-bar";
import { CandidateTable, type CandidateRow } from "@/components/candidates/candidate-table";
import { CandidateTableSkeleton } from "@/components/candidates/candidate-table-skeleton";
import { AddCandidateButton } from "@/components/candidates/add-candidate-button";
import { BulkActions } from "@/components/shared/bulk-actions";
import { JobStatusToggle, type JobStatusFilter } from "@/components/candidates/job-status-toggle";
import type { CandidateCategory } from "@/app/(app)/candidates/actions";

export const dynamic = "force-dynamic";

const APP_VIEWS = ["my", "all"] as const;
const CAT_VIEWS: Record<string, CandidateCategory> = {
  talent_pool: "talent_pool",
  archived: "archived",
  duplicates: "duplicate"
};
const ALLOWED_PAGE_SIZES = new Set([10, 25, 50, 100]);
const DEFAULT_PAGE_SIZE = 25;

function isAppView(v: string): v is typeof APP_VIEWS[number] {
  return (APP_VIEWS as readonly string[]).includes(v);
}
function normalizeStatus(raw?: string): JobStatusFilter {
  return raw === "closed" ? "closed" : "active";
}
function sanitizeSearch(raw?: string): string {
  return (raw ?? "").replace(/[,()%*\\]/g, " ").trim();
}

interface DashboardData {
  jobs: Array<{ id: string; title: string; candidate_count: number }>;
  counts: { my: number; all: number; talent_pool: number; archived: number; duplicates: number };
}

export default async function CandidatesPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; status?: string; job?: string; stage?: string; source?: string; q?: string; page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  // Default view is now "all" (tabs reordered — All is first). Any legacy link
  // with ?view=my keeps working.
  const view = params.view ?? "all";
  const jobStatus = normalizeStatus(params.status);
  const search = sanitizeSearch(params.q);
  const page = Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0);
  const rawPageSize = Number.parseInt(params.pageSize ?? "", 10) || DEFAULT_PAGE_SIZE;
  const pageSize = ALLOWED_PAGE_SIZES.has(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ---------------------------------------------------------------------------
  // Shell data: sidebar jobs + all 5 tab counts + stages. Fetched together in
  // a single RPC + one small query. This is the only synchronous work — the
  // row table is Suspense-boundaried below and streams in.
  // ---------------------------------------------------------------------------
  const [dashRes, { data: stages }] = await Promise.all([
    supabase.rpc("candidates_dashboard", { p_job_status: jobStatus, p_user_id: user?.id ?? null }),
    supabase.from("stages").select("id, name").eq("is_archived", false).order("order")
  ]);
  const dash = (dashRes.data as DashboardData | null) ?? {
    jobs: [],
    counts: { my: 0, all: 0, talent_pool: 0, archived: 0, duplicates: 0 }
  };

  return (
    <>
      <CandidatesSubTabs counts={dash.counts} />
      <div className="flex min-h-[calc(100vh-6rem)]">
        <CandidatesSidebar
          jobStatus={jobStatus}
          jobs={dash.jobs}
          counts={{ my: dash.counts.my, upcomingInterviews: 0, pendingFeedback: 0 }}
        />

        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-xl font-semibold tracking-tight">{titleFor(view)}</h1>
                {/* Section-level count from the RPC — immediate, no waiting on the row query. */}
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                  {(dash.counts[view as keyof DashboardData["counts"]] ?? 0).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{subtitleFor(view, jobStatus)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusToggle value={jobStatus} />
              <BulkActions kind="candidates" exportQuery={`?view=${view}&status=${jobStatus}${params.job ? `&job=${params.job}` : ""}`} />
              <AddCandidateButton
                jobs={dash.jobs.map((j) => ({ id: j.id, title: j.title }))}
                stages={(stages ?? []) as never}
              />
            </div>
          </header>

          <div className="mt-5">
            <CandidateFilterBar stages={(stages ?? []) as never} />
          </div>

          <div className="mt-4">
            {/* Suspense boundary — shell above paints without waiting on the row query.
                key= forces a fresh <Suspense> whenever the query changes so the skeleton
                shows immediately during tab / status / page switches. */}
            <Suspense
              key={`${view}-${jobStatus}-${params.job ?? ""}-${params.stage ?? ""}-${params.source ?? ""}-${search}-${page}-${pageSize}`}
              fallback={<CandidateTableSkeleton pageSize={pageSize} />}
            >
              <CandidateRowsPane
                view={view}
                jobStatus={jobStatus}
                userId={user?.id ?? null}
                jobFilter={params.job ?? null}
                stageFilter={params.stage ?? null}
                sourceFilter={params.source ?? null}
                search={search}
                page={page}
                pageSize={pageSize}
                stages={(stages ?? []) as { id: string; name: string }[]}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Row-fetching subtree (streamed inside Suspense so the header + tabs +
// sidebar don't wait for it).
// ---------------------------------------------------------------------------

async function CandidateRowsPane(props: {
  view: string;
  jobStatus: JobStatusFilter;
  userId: string | null;
  jobFilter: string | null;
  stageFilter: string | null;
  sourceFilter: string | null;
  search: string;
  page: number;
  pageSize: number;
  stages: { id: string; name: string }[];
}) {
  const { view, jobStatus, userId, jobFilter, stageFilter, sourceFilter, search, page, pageSize, stages } = props;
  const supabase = await createClient();
  const rangeFrom = page * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let rows: CandidateRow[] = [];
  let filteredTotal = 0;

  if (isAppView(view)) {
    // App-centric — filter joins directly on jobs.status. Skips the expensive
    // eligibility pre-query entirely; that pre-query is only needed for
    // candidate-centric views.
    let q = supabase
      .from("applications")
      .select(`
        id, applied_at, updated_at, current_stage_id,
        candidate:candidates!inner ( id, first_name, last_name, email, phone, source, preferred_location, current_company, gender, experience_years, experience_months, owner_id, category ),
        job:jobs!inner ( id, title, status ),
        stage:stages ( id, name )
      `, { count: "exact" })
      .eq("candidates.category", "active")
      .eq("jobs.status", jobStatus)
      .order("updated_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (jobFilter)    q = q.eq("job_id", jobFilter);
    if (view === "my" && userId) q = q.eq("candidates.owner_id", userId);
    if (stageFilter)  q = q.eq("current_stage_id", stageFilter);
    if (sourceFilter) q = q.eq("candidates.source", sourceFilter);
    if (search) {
      q = q.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
        { referencedTable: "candidates" }
      );
    }

    const { data: applications, count } = await q;
    filteredTotal = count ?? 0;
    const apps = (applications ?? []) as any[];

    const candidateIds = apps.map((a) => a.candidate?.id).filter(Boolean) as string[];
    const resumeByCandidate = await fetchLatestResumes(supabase, candidateIds);

    rows = apps.map((a) => ({
      application_id: a.id,
      candidate_id: a.candidate?.id ?? "",
      first_name: a.candidate?.first_name ?? "",
      last_name: a.candidate?.last_name ?? null,
      job_title: a.job?.title ?? null,
      stage_id: a.current_stage_id ?? null,
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
      gender: a.candidate?.gender ?? null,
      category: a.candidate?.category ?? "active",
      resume_document: resumeByCandidate.get(a.candidate?.id ?? "") ?? null
    }));
  } else if (view in CAT_VIEWS) {
    // Candidate-centric. Fetch eligible ids via the RPC (one call, no URL bloat)
    // and use them as the .in() filter. Only path that still needs this.
    const cat = CAT_VIEWS[view];
    const { data: eligibleIds } = await supabase.rpc("candidate_ids_by_job_status", { p_status: jobStatus });
    const idFilter = (eligibleIds as string[] | null)?.length
      ? (eligibleIds as string[])
      : ["00000000-0000-0000-0000-000000000000"];

    let cq = supabase
      .from("candidates")
      .select(`
        id, first_name, last_name, email, phone, source, preferred_location, current_company, gender, experience_years, experience_months, category, updated_at,
        applications ( id, applied_at, updated_at, current_stage_id, job:jobs(title, status), stage:stages(name) )
      `, { count: "exact" })
      .eq("category", cat)
      .in("id", idFilter)
      .order("updated_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (sourceFilter) cq = cq.eq("source", sourceFilter);
    if (search) {
      cq = cq.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: candidates, count } = await cq;
    filteredTotal = count ?? 0;
    const cRows = (candidates ?? []) as any[];
    const candidateIds = cRows.map((c) => c.id);
    const resumeByCandidate = await fetchLatestResumes(supabase, candidateIds);

    rows = cRows.map((c) => {
      const apps = ((c.applications ?? []) as any[]).filter((a) => a.job?.status === jobStatus);
      const latest = apps.length ? apps.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)) : null;
      return {
        application_id: latest?.id ?? null,
        candidate_id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        job_title: latest?.job?.title ?? null,
        stage_id: latest?.current_stage_id ?? null,
        stage_name: latest?.stage?.name ?? null,
        experience_years: c.experience_years,
        experience_months: c.experience_months,
        applied_at: latest?.applied_at ?? null,
        updated_at: c.updated_at,
        source: c.source,
        email: c.email,
        phone: c.phone,
        preferred_location: c.preferred_location,
        current_company: c.current_company,
        gender: c.gender,
        category: c.category as CandidateCategory,
        resume_document: resumeByCandidate.get(c.id) ?? null
      };
    });
  }

  return (
    <CandidateTable
      rows={rows}
      stages={stages}
      total={filteredTotal}
      page={page}
      pageSize={pageSize}
      emptyHint={rows.length === 0 ? emptyHintFor(view, jobStatus) : null}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function titleFor(view: string) {
  return ({
    my: "My candidates",
    all: "All candidates",
    talent_pool: "Talent Pool",
    archived: "Archived candidates",
    duplicates: "Duplicates"
  } as Record<string, string>)[view] ?? "Candidates";
}

function subtitleFor(view: string, jobStatus: JobStatusFilter) {
  const scope = jobStatus === "active" ? "active" : "closed";
  return ({
    my: `Active candidates you own on ${scope} jobs.`,
    all: `Every active candidate on ${scope} jobs in this organisation.`,
    talent_pool: `Candidates parked for future opportunities who applied to ${scope} jobs.`,
    archived: `Inactive candidates from ${scope} jobs. Restore any time.`,
    duplicates: `Duplicate profiles from ${scope} jobs. Review and restore if needed.`
  } as Record<string, string>)[view] ?? "";
}

function emptyHintFor(view: string, jobStatus: JobStatusFilter): string {
  const scope = jobStatus === "active" ? "active jobs" : "closed jobs";
  const base = ({
    my: "candidates on your",
    all: "candidates on",
    talent_pool: "talent pool candidates on",
    archived: "archived candidates on",
    duplicates: "duplicates on"
  } as Record<string, string>)[view] ?? "candidates on";
  return `No ${base} ${scope}.`;
}

async function fetchLatestResumes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  candidateIds: string[]
) {
  const map = new Map<string, { id: string; name: string; mime: string | null; storage_bucket: string; storage_path: string }>();
  if (!candidateIds.length) return map;

  const { data } = await supabase
    .from("documents")
    .select("id, candidate_id, name, mime, storage_bucket, storage_path, created_at")
    .in("candidate_id", candidateIds)
    .eq("kind", "resume")
    .order("created_at", { ascending: false });

  for (const d of (data as Array<{ id: string; candidate_id: string; name: string; mime: string | null; storage_bucket: string; storage_path: string }> | null) ?? []) {
    if (!map.has(d.candidate_id)) {
      map.set(d.candidate_id, {
        id: d.id, name: d.name, mime: d.mime,
        storage_bucket: d.storage_bucket, storage_path: d.storage_path
      });
    }
  }
  return map;
}
