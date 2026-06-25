import Link from "next/link";
import { CalendarClock, Clock, BadgeCheck, Target, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/utils";

interface FunnelRow { stage_id: string; stage_name: string; stage_order: number; count: number }
interface TeamMember { user_id: string; role_on_job: string; user: { first_name: string | null; last_name: string | null; email: string } | null }

interface Props {
  jobId: string;
  job: {
    title: string;
    description: string | null;
    openings: number;
    hires: number;
    target_close_date: string | null;
    created_at: string;
  };
  funnel: FunnelRow[];
  team: TeamMember[];
  upcomingInterviews: number;
}

export function JobDashboardTab({ jobId, job, funnel, team, upcomingInterviews }: Props) {
  const totalCandidates = funnel.reduce((sum, s) => sum + Number(s.count), 0);
  const hiredCount = funnel.find((s) => /hired/i.test(s.stage_name))?.count ?? 0;
  const daysOpen = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86_400_000));
  const targetExceeded =
    job.target_close_date && new Date(job.target_close_date).getTime() < Date.now()
      ? Math.floor((Date.now() - new Date(job.target_close_date).getTime()) / 86_400_000)
      : 0;

  const recruiters = team.filter((t) => t.role_on_job === "recruiter");
  const hiringManagers = team.filter((t) => t.role_on_job === "hiring_manager");
  const interviewers = team.filter((t) => t.role_on_job === "interviewer");

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Upcoming interviews"
          value={upcomingInterviews}
          icon={CalendarClock}
          tone="hsl(200 80% 60%)"
        />
        <KpiTile
          label="Days open"
          value={daysOpen}
          icon={Clock}
          tone="hsl(45 90% 60%)"
        />
        <KpiTile
          label="Total candidates"
          value={totalCandidates}
          icon={BadgeCheck}
          tone="hsl(8 81% 56%)"
        />
        <KpiTile
          label="Closed / Total positions"
          value={`${hiredCount}/${job.openings}`}
          icon={Target}
          tone="hsl(265 80% 65%)"
          sublabel={targetExceeded > 0 ? `${targetExceeded} days exceeded` : null}
          sublabelTone={targetExceeded > 0 ? "rose" : "muted"}
        />
      </div>

      {/* Candidate pipeline */}
      <section className="rounded-xl border border-border bg-card p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Candidate pipeline</h2>
          <Link href={`/jobs/${jobId}?tab=candidates`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            View all candidates <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        {funnel.length === 0 ? (
          <p className="text-xs text-muted-foreground">No stages configured for this organisation yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {funnel.map((s) => (
              <Link
                key={s.stage_id}
                href={`/jobs/${jobId}?tab=candidates&stage=${s.stage_id}`}
                className="group rounded-lg border border-border bg-background/40 p-3 text-center transition-colors hover:border-primary/40"
              >
                <div className="text-2xl font-semibold tabular-nums group-hover:text-primary">{s.count}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{s.stage_name}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Description preview + hiring team */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Job description</h2>
            <Link href={`/jobs/${jobId}?tab=description`} className="text-xs text-primary hover:underline">
              View more details
            </Link>
          </header>
          {job.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground line-clamp-6">
              {stripHtml(job.description)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No description provided yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Hiring team</h2>
            <Link href={`/jobs/${jobId}/edit`} className="text-xs text-primary hover:underline">
              Manage
            </Link>
          </header>
          <TeamGroup label="Recruiters" members={recruiters} />
          <TeamGroup label="Hiring managers" members={hiringManagers} />
          <TeamGroup label="Interviewers" members={interviewers} />
          {team.length === 0 && (
            <p className="text-xs text-muted-foreground">No team assigned yet.</p>
          )}
          <p className="mt-4 text-[11px] text-muted-foreground">
            Created {formatDate(job.created_at)}
          </p>
        </section>
      </div>
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, tone, sublabel, sublabelTone }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  sublabel?: string | null;
  sublabelTone?: "rose" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sublabel && (
        <div className={"mt-1 text-[11px] " + (sublabelTone === "rose" ? "text-rose-400" : "text-muted-foreground")}>{sublabel}</div>
      )}
    </div>
  );
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function TeamGroup({ label, members }: { label: string; members: TeamMember[] }) {
  if (!members.length) return null;
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <ul className="space-y-1.5">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2">
            <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px]">{initials(m.user?.first_name, m.user?.last_name)}</AvatarFallback></Avatar>
            <span className="truncate text-sm">{m.user?.first_name} {m.user?.last_name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
