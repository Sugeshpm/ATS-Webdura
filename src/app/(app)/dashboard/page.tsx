import Link from "next/link";
import {
  Briefcase, Users, CalendarClock, Trophy, ArrowRight, ArrowUpRight,
  UserPlus, ArrowRightCircle, StickyNote, FileText
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge, stageBadgeVariant } from "@/components/ui/badge";
import { formatDate, initials, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type FunnelRow = { stage_id: string; stage_name: string; stage_order: number; count: number };

export default async function DashboardPage() {
  const supabase = await createClient();
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const [
    { count: activeJobs },
    { count: candidatesCount },
    { count: upcomingInterviewsCount },
    { count: hiredThisMonth },
    { data: recentHistory },
    { data: upcomingInterviews },
    { data: pipelineStages }
  ] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("category", "active"),
    supabase.from("interviews").select("id", { count: "exact", head: true })
      .gte("scheduled_start", new Date().toISOString())
      .eq("status", "scheduled"),
    supabase.from("application_stage_history")
      .select("id, to_stage:stages!application_stage_history_to_stage_id_fkey!inner(code)", { count: "exact", head: true })
      .eq("to_stage.code", "hired")
      .gte("moved_at", startOfMonth.toISOString()),
    supabase
      .from("application_stage_history")
      .select(`
        id, moved_at, comment,
        from_stage:stages!application_stage_history_from_stage_id_fkey(name, code),
        to_stage:stages!application_stage_history_to_stage_id_fkey(name, code),
        mover:profiles!application_stage_history_moved_by_fkey(first_name, last_name),
        application:applications!inner(
          id,
          candidate:candidates!inner(id, first_name, last_name),
          job:jobs!inner(id, title)
        )
      `)
      .order("moved_at", { ascending: false })
      .limit(6),
    supabase
      .from("interviews")
      .select(`
        id, scheduled_start, mode, status,
        application:applications!inner(
          id,
          candidate:candidates!inner(first_name, last_name),
          job:jobs!inner(title)
        )
      `)
      .gte("scheduled_start", new Date().toISOString())
      .eq("status", "scheduled")
      .order("scheduled_start", { ascending: true })
      .limit(5),
    supabase.from("stages").select("id, name, code, order, color").eq("is_archived", false).order("order")
  ]);

  // Per-stage counts across all jobs. Use COUNT queries (head:true) rather than
  // fetching rows and tallying in JS — a row fetch is capped at Supabase's 1000-row
  // response limit, which silently truncates and skews the distribution (everything
  // lands under one stage) once there are >1000 applications.
  let pipelineRows: FunnelRow[] = [];
  if (pipelineStages?.length) {
    const stages = pipelineStages as { id: string; name: string; order: number }[];
    const counts = await Promise.all(
      stages.map((s) =>
        supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("current_stage_id", s.id)
          .eq("is_archived", false)
      )
    );
    pipelineRows = stages.map((s, i) => ({
      stage_id: s.id,
      stage_name: s.name,
      stage_order: s.order,
      count: counts[i].count ?? 0
    }));
  }
  const pipelineTotal = pipelineRows.reduce((sum, s) => sum + s.count, 0);

  const tiles = [
    { label: "Active jobs",          value: activeJobs ?? 0,                 icon: Briefcase,     href: "/jobs",       tone: "hsl(0 84% 60%)" },
    { label: "Candidates",           value: candidatesCount ?? 0,            icon: Users,         href: "/candidates", tone: "hsl(200 80% 50%)" },
    { label: "Upcoming interviews",  value: upcomingInterviewsCount ?? 0,    icon: CalendarClock, href: "/candidates", tone: "hsl(265 70% 60%)" },
    { label: "Hired this month",     value: hiredThisMonth ?? 0,             icon: Trophy,        href: "/reports",    tone: "hsl(160 70% 40%)" }
  ];

  return (
    <div className="container max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Page heading */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s a snapshot of your organisation&apos;s hiring activity.
        </p>
      </header>

      {/* KPI row */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href, tone }) => (
          <Link key={label} href={href} className="group">
            <article className="h-full rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-card-hover">
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium text-muted-foreground">{label}</div>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `color-mix(in srgb, ${tone} 15%, transparent)`, color: tone }}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-semibold tabular-nums">{value}</div>
                <span className="inline-flex items-center text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  View <ArrowUpRight className="ml-0.5 h-3 w-3" />
                </span>
              </div>
            </article>
          </Link>
        ))}
      </section>

      {/* Hiring pipeline overview */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Hiring pipeline</h2>
            <p className="text-xs text-muted-foreground">{pipelineTotal} active applications across all jobs</p>
          </div>
          <Link href="/candidates" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            View candidates <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {pipelineRows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Add candidates to a job to see the pipeline.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {pipelineRows.map((s) => (
              <div key={s.stage_id} className="rounded-lg border border-border bg-surface-sunken p-3">
                <div className="text-2xl font-semibold tabular-nums">{s.count}</div>
                <div className="mt-1 truncate text-[11px] uppercase tracking-wider text-muted-foreground" title={s.stage_name}>{s.stage_name}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity + Upcoming interviews + Pending tasks */}
      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card lg:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <p className="text-xs text-muted-foreground">Stage changes from your pipeline.</p>
            </div>
          </header>
          {(recentHistory ?? []).length === 0 ? (
            <EmptyRow icon={StickyNote} hint="No activity yet. Move a candidate through a stage to see it here." />
          ) : (
            <ul className="space-y-3">
              {(recentHistory ?? []).map((h: any) => (
                <li key={h.id} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "color-mix(in srgb, hsl(265 70% 60%) 15%, transparent)", color: "hsl(265 70% 60%)" }}
                  >
                    <ArrowRightCircle className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{h.mover?.first_name} {h.mover?.last_name}</span>
                      <span className="text-muted-foreground"> moved </span>
                      <Link href={`/candidates/${h.application?.id}`} className="font-medium hover:underline">
                        {h.application?.candidate?.first_name} {h.application?.candidate?.last_name}
                      </Link>
                      <span className="text-muted-foreground"> from </span>
                      <Badge variant={stageBadgeVariant(h.from_stage?.code)}>{h.from_stage?.name ?? "—"}</Badge>
                      <span className="text-muted-foreground"> to </span>
                      <Badge variant={stageBadgeVariant(h.to_stage?.code)}>{h.to_stage?.name ?? "—"}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {h.application?.job?.title} · {formatDate(h.moved_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pending tasks */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <header className="mb-4">
            <h2 className="text-sm font-semibold">My pending tasks</h2>
            <p className="text-xs text-muted-foreground">Feedback to submit, candidates to review.</p>
          </header>
          <EmptyRow icon={FileText} hint="You're all caught up." />
        </div>
      </section>

      {/* Upcoming interviews */}
      <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Upcoming interviews</h2>
            <p className="text-xs text-muted-foreground">Next 5 scheduled interviews.</p>
          </div>
          <Link href="/candidates" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            See all <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {(upcomingInterviews ?? []).length === 0 ? (
          <EmptyRow icon={CalendarClock} hint="No interviews scheduled. Schedule one from any candidate's profile." />
        ) : (
          <ul className="divide-y divide-border">
            {(upcomingInterviews ?? []).map((iv: any) => (
              <li key={iv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials(iv.application?.candidate?.first_name, iv.application?.candidate?.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <Link href={`/candidates/${iv.application?.id}`} className="block text-sm font-medium hover:underline">
                    {iv.application?.candidate?.first_name} {iv.application?.candidate?.last_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{iv.application?.job?.title}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-medium">{formatDate(iv.scheduled_start, { day: "2-digit", month: "short" })}</div>
                  <div className="text-muted-foreground">{formatDate(iv.scheduled_start, { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <Badge variant="info" className="ml-2">{iv.mode}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ icon: Icon, hint }: { icon: React.ComponentType<{ className?: string }>; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-sunken py-8 text-center">
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <p className="px-4 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
