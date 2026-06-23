import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Mail, ChevronLeft, ChevronRight, CalendarPlus, MessageSquare, MoreHorizontal, Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageMoveMenu } from "@/components/candidates/stage-move-menu";
import { NotesRail } from "@/components/candidates/notes-rail";
import { initials, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select(`
      id, applied_at, current_stage_id, applied_via,
      candidate:candidates ( id, first_name, last_name, email, phone, current_location, experience_years, experience_months, notice_period_days, source, current_salary, current_salary_currency, owner_id, linkedin_url, github_url, portfolio_url ),
      job:jobs ( id, title ),
      stage:stages ( id, name, code )
    `)
    .eq("id", applicationId)
    .single();

  if (!app) return notFound();
  const candidate = (app as any).candidate;
  const job = (app as any).job;
  const stage = (app as any).stage;

  const [{ data: stages }, { data: notes }, { data: experiences }, { data: educations }, { data: skillsRows }, { data: documents }, { data: owner }] = await Promise.all([
    supabase.from("stages").select("id, name").eq("is_archived", false).order("order"),
    supabase.from("notes").select("id, body, created_at, author:profiles(first_name, last_name)").eq("application_id", applicationId).order("created_at", { ascending: false }),
    supabase.from("candidate_experiences").select("*").eq("candidate_id", candidate.id).order("start_date", { ascending: false }),
    supabase.from("candidate_educations").select("*").eq("candidate_id", candidate.id).order("end_year", { ascending: false }),
    supabase.from("candidate_skills").select("skill:skills(id, name)").eq("candidate_id", candidate.id),
    supabase.from("documents").select("id, name, kind, mime, size_bytes, created_at, storage_bucket, storage_path").eq("candidate_id", candidate.id).order("created_at", { ascending: false }),
    candidate.owner_id ? supabase.from("profiles").select("first_name, last_name").eq("id", candidate.owner_id).single() : Promise.resolve({ data: null })
  ]);

  const skills = (skillsRows ?? []).map((r: any) => r.skill).filter(Boolean) as { id: string; name: string }[];

  return (
    <div className="flex">
      <div className="flex-1 px-6 py-5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            {job?.title && <Link href={`/jobs/${job.id}`} className="text-primary hover:underline">{job.title}</Link>}
            <span>›</span>
            <span className="uppercase">{stage?.name ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded p-1 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-muted-foreground">—</span>
            <button className="rounded p-1 hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <header className="mt-3 flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{initials(candidate.first_name, candidate.last_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{candidate.first_name} {candidate.last_name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {candidate.source && `Sourced from ${candidate.source}`}
              {app.applied_at && ` on ${formatDate(app.applied_at)}`}
              {owner?.data && ` | Owner: ${owner.data.first_name ?? ""} ${owner.data.last_name ?? ""}`.toUpperCase()}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
              {candidate.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{candidate.phone}</span>}
              {candidate.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{candidate.email}</span>}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">Hiring Stage</div>
              <StageMoveMenu applicationId={applicationId} currentStageId={app.current_stage_id} stages={(stages ?? []) as never} />
              <Button variant="outline" className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"><Archive className="mr-1 h-4 w-4" /> Archive</Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">Interactions</div>
              <Button variant="outline" size="sm"><CalendarPlus className="mr-1 h-4 w-4" /> Schedule</Button>
              <button className="rounded p-1.5 hover:bg-secondary" aria-label="Email"><Mail className="h-4 w-4" /></button>
              <button className="rounded p-1.5 hover:bg-secondary" aria-label="WhatsApp"><MessageSquare className="h-4 w-4" /></button>
              <button className="rounded p-1.5 hover:bg-secondary" aria-label="More"><MoreHorizontal className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        <Tabs defaultValue="profile" className="mt-6">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
              <Fact label="Available To Join (in days)" value={candidate.notice_period_days ?? "0 days"} />
              <Fact label="Experience" value={`${candidate.experience_years ?? 0}y ${candidate.experience_months ?? 0}m`} />
              <Fact label="Location" value={candidate.current_location ?? "—"} />
              <Fact label="Current Salary" value={candidate.current_salary ? `${candidate.current_salary_currency} ${candidate.current_salary}` : "—"} />
            </div>

            <section className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Skills</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.map((s) => <Badge key={s.id} variant="outline">{s.name}</Badge>)}
                {!skills.length && <span className="text-xs text-muted-foreground">No skills added.</span>}
              </div>
            </section>

            <section className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Experience</div>
              <ul className="mt-2 space-y-2 text-sm">
                {(experiences ?? []).map((e: any) => (
                  <li key={e.id} className="rounded-md border border-border p-3">
                    <div className="font-medium">{e.title} <span className="text-muted-foreground">@ {e.company}</span></div>
                    <div className="text-xs text-muted-foreground">{e.start_date} — {e.is_current ? "Present" : e.end_date}</div>
                    {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
                  </li>
                ))}
                {!experiences?.length && <li className="text-xs text-muted-foreground">+ Add experience</li>}
              </ul>
            </section>

            <section className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Education</div>
              <ul className="mt-2 space-y-2 text-sm">
                {(educations ?? []).map((e: any) => (
                  <li key={e.id} className="rounded-md border border-border p-3">
                    <div className="font-medium">{e.degree} {e.field && `· ${e.field}`}</div>
                    <div className="text-xs text-muted-foreground">{e.institution} · {e.start_year} — {e.end_year}</div>
                  </li>
                ))}
                {!educations?.length && <li className="text-xs text-muted-foreground">+ Add education details</li>}
              </ul>
            </section>
          </TabsContent>

          <TabsContent value="documents">
            <ul className="space-y-2">
              {(documents ?? []).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.kind} · {Math.round((d.size_bytes ?? 0) / 1024)} KB · {formatDate(d.created_at)}</div>
                  </div>
                  <Button variant="outline" size="sm">Download</Button>
                </li>
              ))}
              {!documents?.length && <li className="text-xs text-muted-foreground">No documents uploaded.</li>}
            </ul>
          </TabsContent>

          <TabsContent value="messages"><p className="text-sm text-muted-foreground">Messaging coming in Phase 2.</p></TabsContent>
          <TabsContent value="feedback"><p className="text-sm text-muted-foreground">Scorecards & feedback coming in Phase 2.</p></TabsContent>
          <TabsContent value="engagement"><p className="text-sm text-muted-foreground">Engagement signals coming in Phase 2.</p></TabsContent>
          <TabsContent value="activity"><p className="text-sm text-muted-foreground">Activity log coming soon.</p></TabsContent>
        </Tabs>
      </div>

      <NotesRail applicationId={applicationId} notes={(notes ?? []) as never} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
