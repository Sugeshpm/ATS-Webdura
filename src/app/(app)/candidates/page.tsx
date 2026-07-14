import { createClient } from "@/lib/supabase/server";
import { CandidatesSidebar } from "@/components/candidates/sidebar";
import { CandidateFilterBar } from "@/components/candidates/candidate-filter-bar";
import { CandidateTable, type CandidateRow } from "@/components/candidates/candidate-table";
import { AddCandidateButton } from "@/components/candidates/add-candidate-button";
import { BulkActions } from "@/components/shared/bulk-actions";
import type { CandidateCategory } from "@/app/(app)/candidates/actions";

export const dynamic = "force-dynamic";

const APP_VIEWS = ["my", "all"] as const;
const CAT_VIEWS: Record<string, CandidateCategory> = {
  talent_pool: "talent_pool",
  archived: "archived",
  duplicates: "duplicate"
};

function isAppView(v: string): v is typeof APP_VIEWS[number] {
  return (APP_VIEWS as readonly string[]).includes(v);
}

/** Strip characters that would break a PostgREST or()/ilike filter string. */
function sanitizeSearch(raw?: string): string {
  return (raw ?? "").replace(/[,()%*\\]/g, " ").trim();
}

export default async function CandidatesPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; job?: string; stage?: string; source?: string; q?: string }>;
}) {
  const params = await searchParams;
  const view = params.view ?? "my";
  const search = sanitizeSearch(params.q);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let rows: CandidateRow[] = [];

  if (isAppView(view)) {
    // Application-centric: one row per candidate × job, only active candidates.
    let q = supabase
      .from("applications")
      .select(`
        id, applied_at, updated_at, current_stage_id,
        candidate:candidates!inner ( id, first_name, last_name, email, phone, source, preferred_location, current_company, gender, experience_years, experience_months, owner_id, category ),
        job:jobs!inner ( id, title ),
        stage:stages ( id, name )
      `)
      .eq("candidates.category", "active")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (params.job) q = q.eq("job_id", params.job);
    if (view === "my" && user) q = q.eq("candidates.owner_id", user.id);
    if (params.stage) q = q.eq("current_stage_id", params.stage);
    if (params.source) q = q.eq("candidates.source", params.source);
    if (search) {
      q = q.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
        { referencedTable: "candidates" }
      );
    }

    const { data: applications } = await q;
    const apps = (applications ?? []) as any[];

    // Batch-fetch each candidate's latest resume document (skipped if there are no rows).
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
    // Candidate-centric: one row per candidate, embeds latest application for context.
    const cat = CAT_VIEWS[view];
    let cq = supabase
      .from("candidates")
      .select(`
        id, first_name, last_name, email, phone, source, preferred_location, current_company, gender, experience_years, experience_months, category, updated_at,
        applications ( id, applied_at, updated_at, current_stage_id, job:jobs(title), stage:stages(name) )
      `)
      .eq("category", cat)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (params.source) cq = cq.eq("source", params.source);
    if (search) {
      cq = cq.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: candidates } = await cq;
    const cRows = (candidates ?? []) as any[];
    const candidateIds = cRows.map((c) => c.id);
    const resumeByCandidate = await fetchLatestResumes(supabase, candidateIds);

    rows = cRows.map((c) => {
      const apps = (c.applications ?? []) as any[];
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

  // Sidebar/filter data (always)
  const [{ data: jobs }, { data: stages }] = await Promise.all([
    supabase.from("v_jobs_with_counts").select("id, title, candidate_count").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("stages").select("id, name").eq("is_archived", false).order("order")
  ]);

  return (
    <div className="flex min-h-[calc(100vh-6rem)]">
      <CandidatesSidebar
        activeJobs={(jobs ?? []).map((j: any) => ({ id: j.id, title: j.title, candidate_count: j.candidate_count }))}
        counts={{ my: rows.length, upcomingInterviews: 0, pendingFeedback: 0 }}
      />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-semibold tracking-tight">{titleFor(view)}</h1>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{rows.length}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{subtitleFor(view)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BulkActions kind="candidates" exportQuery={`?view=${view}${params.job ? `&job=${params.job}` : ""}`} />
            <AddCandidateButton
              jobs={(jobs ?? []).map((j: any) => ({ id: j.id, title: j.title }))}
              stages={(stages ?? []) as never}
            />
          </div>
        </header>

        <div className="mt-5">
          <CandidateFilterBar stages={(stages ?? []) as never} />
        </div>

        <div className="mt-4">
          <CandidateTable rows={rows} stages={(stages ?? []) as { id: string; name: string }[]} />
        </div>
      </div>
    </div>
  );
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
    // Order desc → first seen per candidate is the newest; skip subsequent.
    if (!map.has(d.candidate_id)) {
      map.set(d.candidate_id, {
        id: d.id, name: d.name, mime: d.mime,
        storage_bucket: d.storage_bucket, storage_path: d.storage_path
      });
    }
  }
  return map;
}

function titleFor(view: string) {
  return ({
    my: "My candidates",
    all: "All candidates",
    talent_pool: "Talent Pool",
    archived: "Archived candidates",
    duplicates: "Duplicates"
  } as Record<string, string>)[view] ?? "Candidates";
}

function subtitleFor(view: string) {
  return ({
    my: "Active candidates you own across all your jobs.",
    all: "Every active candidate in this organisation.",
    talent_pool: "Candidates parked for future opportunities. Searchable, not tied to a current hiring workflow.",
    archived: "Inactive candidates hidden from the active list. Restore any time.",
    duplicates: "Profiles flagged as duplicates. Review and restore if needed."
  } as Record<string, string>)[view] ?? "";
}
