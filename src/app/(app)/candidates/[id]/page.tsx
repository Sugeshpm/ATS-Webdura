import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Folder, MessageSquare, MessagesSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { SummaryCards } from "@/components/candidates/candidate-detail/summary-cards";
import { ProfileTab } from "@/components/candidates/candidate-detail/profile-tab";
import { ResumePanel } from "@/components/candidates/candidate-detail/resume-panel";
import { ActivityTimeline, type ActivityEntry } from "@/components/candidates/candidate-detail/activity-timeline";
import { NotesTab } from "@/components/candidates/candidate-detail/notes-tab";
import { CandidateDetailShell } from "@/components/candidates/candidate-detail/candidate-detail-shell";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: app } = await supabase
    .from("applications")
    .select(`
      id, applied_at, current_stage_id, applied_via, is_archived,
      candidate:candidates (
        id, tenant_id, first_name, middle_name, last_name, email, phone, gender, date_of_birth,
        current_company, current_location, preferred_location,
        experience_years, experience_months, notice_period_days,
        current_salary, current_salary_currency, expected_salary, expected_salary_currency,
        source, owner_id, linkedin_url, github_url, portfolio_url,
        category, updated_at
      ),
      job:jobs ( id, title ),
      stage:stages ( id, name, code, color )
    `)
    .eq("id", applicationId)
    .single();

  if (!app) return notFound();
  const candidate = (app as any).candidate;
  const job = (app as any).job;
  const stage = (app as any).stage;

  const [
    { data: stages },
    { data: notes },
    { data: experiences },
    { data: educations },
    { data: skillsRows },
    { data: documents },
    { data: stageHistory },
    { data: interviews },
    { data: owner },
    { data: appliedJobs }
  ] = await Promise.all([
    supabase.from("stages").select("id, name").eq("is_archived", false).order("order"),
    supabase.from("notes").select("id, body, created_at, author:profiles(id, first_name, last_name)").eq("application_id", applicationId).order("created_at", { ascending: false }),
    supabase.from("candidate_experiences").select("*").eq("candidate_id", candidate.id).order("start_date", { ascending: false }),
    supabase.from("candidate_educations").select("*").eq("candidate_id", candidate.id).order("end_year", { ascending: false }),
    supabase.from("candidate_skills").select("skill:skills(id, name)").eq("candidate_id", candidate.id),
    supabase.from("documents").select("id, name, kind, mime, size_bytes, created_at, storage_bucket, storage_path, uploaded_by").eq("candidate_id", candidate.id).order("created_at", { ascending: false }),
    supabase.from("application_stage_history").select(`
      id, moved_at, comment,
      from_stage:stages!application_stage_history_from_stage_id_fkey(name),
      to_stage:stages!application_stage_history_to_stage_id_fkey(name),
      mover:profiles!application_stage_history_moved_by_fkey(first_name, last_name)
    `).eq("application_id", applicationId).order("moved_at", { ascending: false }),
    supabase.from("interviews").select("id, scheduled_start, status, created_at, created_by").eq("application_id", applicationId).order("scheduled_start", { ascending: false }),
    candidate.owner_id ? supabase.from("profiles").select("first_name, last_name").eq("id", candidate.owner_id).single() : Promise.resolve({ data: null }),
    supabase.from("applications").select("id").eq("candidate_id", candidate.id)
  ]);

  const skills = (skillsRows ?? []).map((r: any) => r.skill).filter(Boolean) as { id: string; name: string }[];
  const resume = (documents ?? []).find((d: any) => d.kind === "resume") ?? null;

  // Summary numbers
  const appliedJobsCount = (appliedJobs ?? []).length;
  const interviewsCount = (interviews ?? []).length;
  const notesCount = (notes ?? []).length;

  // Last activity = max of (candidate.updated_at, latest note, latest doc, latest stage move, latest interview)
  const candidateUpdatedAt = candidate.updated_at as string;
  const dates = [
    candidateUpdatedAt,
    ...(notes ?? []).map((n: any) => n.created_at as string),
    ...(documents ?? []).map((d: any) => d.created_at as string),
    ...(stageHistory ?? []).map((h: any) => h.moved_at as string),
    ...(interviews ?? []).map((i: any) => i.scheduled_start as string)
  ].filter(Boolean);
  const lastActivityAt = dates.length ? dates.sort().reverse()[0] : null;

  // Build merged timeline
  const timeline: ActivityEntry[] = [
    { kind: "created", at: app.applied_at, actorName: owner?.data ? `${owner.data.first_name ?? ""} ${owner.data.last_name ?? ""}`.trim() : undefined },
    ...(stageHistory ?? []).map((h: any) => ({
      kind: "stage_change" as const,
      at: h.moved_at,
      from: h.from_stage?.name ?? null,
      to: h.to_stage?.name ?? "—",
      actorName: h.mover ? `${h.mover.first_name ?? ""} ${h.mover.last_name ?? ""}`.trim() : undefined,
      comment: h.comment
    })),
    ...(notes ?? []).map((n: any) => ({
      kind: "note" as const,
      at: n.created_at,
      actorName: n.author ? `${n.author.first_name ?? ""} ${n.author.last_name ?? ""}`.trim() : undefined,
      body: n.body
    })),
    ...(documents ?? []).map((d: any) => ({
      kind: "document" as const,
      at: d.created_at,
      name: d.name,
      documentKind: d.kind
    })),
    ...(interviews ?? []).map((i: any) => ({
      kind: "interview" as const,
      at: i.created_at ?? i.scheduled_start,
      scheduled_start: i.scheduled_start,
      status: i.status
    }))
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const candidateForEdit = {
    id: candidate.id,
    first_name: candidate.first_name,
    middle_name: candidate.middle_name,
    last_name: candidate.last_name,
    email: candidate.email,
    phone: candidate.phone,
    gender: candidate.gender,
    date_of_birth: candidate.date_of_birth,
    current_company: candidate.current_company,
    current_location: candidate.current_location,
    preferred_location: candidate.preferred_location,
    experience_years: candidate.experience_years,
    experience_months: candidate.experience_months,
    notice_period_days: candidate.notice_period_days,
    current_salary: candidate.current_salary,
    current_salary_currency: candidate.current_salary_currency,
    expected_salary: candidate.expected_salary,
    expected_salary_currency: candidate.expected_salary_currency,
    source: candidate.source,
    linkedin_url: candidate.linkedin_url,
    github_url: candidate.github_url,
    portfolio_url: candidate.portfolio_url,
    category: (candidate.category ?? "active") as "active" | "talent_pool" | "archived" | "duplicate"
  };

  const summary = (
    <SummaryCards
      stage={stage}
      appliedJobsCount={appliedJobsCount}
      interviewsCount={interviewsCount}
      notesCount={notesCount}
      lastActivityAt={lastActivityAt}
    />
  );

  return (
    <div className="container max-w-7xl space-y-4 py-5 sm:py-6">
      <CandidateDetailShell
        candidate={candidateForEdit as never}
        email={candidate.email}
        header={{
          applicationId,
          display: {
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            current_company: candidate.current_company,
            current_location: candidate.current_location,
            email: candidate.email,
            phone: candidate.phone,
            experience_years: candidate.experience_years,
            experience_months: candidate.experience_months,
            source: candidate.source,
            linkedin_url: candidate.linkedin_url,
            github_url: candidate.github_url,
            portfolio_url: candidate.portfolio_url,
            updated_at: candidate.updated_at
          },
          job,
          stage,
          owner: owner?.data ?? null,
          appliedAt: app.applied_at,
          currentStageId: app.current_stage_id,
          stages: (stages ?? []) as never
        }}
        summary={summary}
        tabs={{
          profile: (
            <ProfileTab
              candidate={candidate}
              experiences={(experiences ?? []) as never}
              educations={(educations ?? []) as never}
              skills={skills}
            />
          ),
          resume: (
            <ResumePanel candidateId={candidate.id} tenantId={candidate.tenant_id} resume={resume as never} />
          ),
          documents: <DocumentsList docs={(documents ?? []) as never} />,
          activity: <ActivityTimeline entries={timeline} />,
          notes: (
            <NotesTab
              applicationId={applicationId}
              currentUserId={user?.id ?? ""}
              notes={(notes ?? []) as never}
            />
          ),
          feedback: <EmptyTab title="No feedback yet" hint="Once interviews are scheduled and scorecards submitted, they'll appear here." icon={MessageSquare} />,
          communication: <EmptyTab title="No conversations yet" hint="Email and WhatsApp threads with this candidate will appear here." icon={MessagesSquare} />
        }}
      />
    </div>
  );
}

function DocumentsList({ docs }: { docs: { id: string; name: string; kind: string; mime: string | null; size_bytes: number | null; created_at: string }[] }) {
  if (!docs.length) {
    return <EmptyTab title="No documents yet" hint="Upload offer letters, ID proofs, or signed agreements." icon={Folder} />;
  }
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{d.name}</div>
            <div className="text-xs text-muted-foreground">{d.kind} · {Math.round((d.size_bytes ?? 0) / 1024)} KB · {formatDate(d.created_at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyTab({ title, hint, icon: Icon }: { title: string; hint: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
