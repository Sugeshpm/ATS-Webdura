import Link from "next/link";
import { Users, CheckCircle2, Calendar, Lock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials } from "@/lib/utils";

type Job = {
  id: string;
  title: string;
  department_name: string | null;
  location_name: string | null;
  business_unit_name: string | null;
  confidential: boolean;
  priority: boolean;
  visibility: "internal" | "career_site" | "external" | "confidential";
  openings: number;
  hires: number;
  target_close_date: string | null;
  candidate_count: number;
  new_candidates_count: number;
  archived_candidates_count: number;
  recruiter?: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null } | null;
};

function visibilityBadge(j: Job) {
  if (j.confidential) return <Badge variant="confidential">CONFIDENTIAL</Badge>;
  if (j.visibility === "career_site" || j.visibility === "external") return <Badge variant="online">ONLINE</Badge>;
  return <Badge variant="offline">OFFLINE</Badge>;
}

export function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.id}`}>
      <article className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
        <header className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{job.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {(job.department_name || "—")} <span className="mx-1 opacity-40">|</span> {(job.location_name || "—")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {job.priority && <span aria-label="Priority" className="h-2 w-2 rounded-full bg-rose-400" />}
            {job.confidential && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {job.candidate_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {job.hires}/{job.openings}
          </span>
          {job.target_close_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(job.target_close_date)}
            </span>
          )}
          {job.recruiter && (
            <Avatar className="ml-auto h-5 w-5">
              <AvatarFallback className="text-[9px]">
                {initials(job.recruiter.first_name, job.recruiter.last_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        <footer className="mt-2 flex items-center justify-between border-t border-border/70 pt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>{job.new_candidates_count} new candidates</span>
            <span className="opacity-50">•</span>
            <span>{job.archived_candidates_count} archived</span>
          </div>
          {visibilityBadge(job)}
        </footer>
      </article>
    </Link>
  );
}
