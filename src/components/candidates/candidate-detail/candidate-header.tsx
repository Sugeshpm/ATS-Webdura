import Link from "next/link";
import { ChevronLeft, ChevronRight, Mail, Phone, MapPin, Briefcase, Clock, Linkedin, Github, Globe, Calendar } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials, formatDate } from "@/lib/utils";
import { StageMoveMenu } from "@/components/candidates/stage-move-menu";

interface Props {
  applicationId: string;
  candidate: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    current_company: string | null;
    current_location: string | null;
    experience_years: number | null;
    experience_months: number | null;
    source: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
    updated_at: string;
  };
  job: { id: string; title: string } | null;
  stage: { id: string; name: string; color: string | null } | null;
  owner: { first_name: string | null; last_name: string | null } | null;
  appliedAt: string;
  currentStageId: string | null;
  stages: { id: string; name: string }[];
}

export function CandidateHeader({
  applicationId, candidate, job, stage, owner, appliedAt, currentStageId, stages
}: Props) {
  const fullName = `${candidate.first_name} ${candidate.last_name ?? ""}`.trim();
  const expYears = candidate.experience_years ?? 0;
  const expMonths = candidate.experience_months ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      {/* Breadcrumb + paginator */}
      <div className="mb-4 flex items-center justify-between text-xs">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          {job?.title && <Link href={`/jobs/${job.id}`} className="truncate text-primary hover:underline">{job.title}</Link>}
          {stage?.name && (<>
            <span>›</span>
            <span className="uppercase tracking-wide">{stage.name}</span>
          </>)}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="rounded p-1 hover:bg-secondary" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <button className="rounded p-1 hover:bg-secondary" aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {/* Avatar + identity */}
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20 shrink-0 ring-2 ring-border">
            <AvatarFallback className="text-xl">{initials(candidate.first_name, candidate.last_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-tight">{fullName}</h1>
            {candidate.current_company && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{candidate.current_company}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {stage && (
                <Badge
                  variant="outline"
                  className="border-current"
                  style={{ color: stage.color ?? "#a78bfa", borderColor: (stage.color ?? "#a78bfa") + "55" }}
                >
                  {stage.name}
                </Badge>
              )}
              {candidate.source && (
                <Badge variant="outline" className="text-muted-foreground">via {candidate.source}</Badge>
              )}
              {owner && (
                <Badge variant="outline" className="text-muted-foreground">
                  Owner: {owner.first_name ?? ""} {owner.last_name ?? ""}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Stage switcher (right side on md+) */}
        <div className="md:ml-auto md:self-start">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Hiring stage</div>
          <div className="mt-1">
            <StageMoveMenu applicationId={applicationId} currentStageId={currentStageId} stages={stages} />
          </div>
        </div>
      </div>

      {/* Meta strip */}
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {candidate.email && (
          <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Mail className="h-4 w-4 shrink-0" /><span className="truncate">{candidate.email}</span>
          </a>
        )}
        {candidate.phone && (
          <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Phone className="h-4 w-4 shrink-0" />{candidate.phone}
          </a>
        )}
        {candidate.current_location && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />{candidate.current_location}
          </span>
        )}
        <span className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="h-4 w-4 shrink-0" />{expYears}y {expMonths}m experience
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />Applied {formatDate(appliedAt)}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />Updated {formatDate(candidate.updated_at)}
        </span>

        {/* Social links */}
        {(candidate.linkedin_url || candidate.github_url || candidate.portfolio_url) && (
          <div className="col-span-full mt-1 flex items-center gap-3">
            {candidate.linkedin_url && (
              <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </a>
            )}
            {candidate.github_url && (
              <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="GitHub">
                <Github className="h-4 w-4" />
              </a>
            )}
            {candidate.portfolio_url && (
              <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Portfolio">
                <Globe className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
