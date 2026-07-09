"use client";
import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Mail, Phone, MapPin, Briefcase, Clock, Calendar,
  Linkedin, Github, Globe, Eye, Download, CalendarPlus, StickyNote, Trash2, MoreHorizontal
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { initials, formatDate } from "@/lib/utils";
import { StageMoveMenu } from "@/components/candidates/stage-move-menu";
import { MoveToMenu } from "@/components/candidates/move-to-menu";
import { CategoryBadge } from "@/components/candidates/candidate-table";
import { EditCandidateDrawer, type CandidateInitial } from "@/components/candidates/edit-candidate-drawer";
import { deleteCandidateAndRedirect, type CandidateCategory } from "@/app/(app)/candidates/actions";

interface Resume {
  id: string;
  name: string;
  mime: string | null;
  storage_bucket: string;
  storage_path: string;
}

interface Display {
  first_name: string;
  last_name: string | null;
  current_company: string | null;
  current_location: string | null;
  email: string | null;
  phone: string | null;
  experience_years: number | null;
  experience_months: number | null;
  source: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  updated_at: string;
}

interface Props {
  applicationId: string;
  display: Display;
  candidate: CandidateInitial & { category: CandidateCategory };
  email: string | null;
  resume: Resume | null;
  job: { id: string; title: string } | null;
  stage: { id: string; name: string; color: string | null } | null;
  owner: { first_name: string | null; last_name: string | null } | null;
  appliedAt: string;
  currentStageId: string | null;
  stages: { id: string; name: string }[];
  onAddNote: () => void;
  onPreviewResume: () => void;
}

export function CandidateHeader({
  applicationId, display, candidate, email, resume, job, stage, owner,
  appliedAt, currentStageId, stages, onAddNote, onPreviewResume
}: Props) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const fullName = `${display.first_name} ${display.last_name ?? ""}`.trim();
  const expYears = display.experience_years ?? 0;
  const expMonths = display.experience_months ?? 0;

  async function downloadResume() {
    if (!resume) return;
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(resume.storage_bucket)
      .createSignedUrl(resume.storage_path, 60, { download: resume.name });
    if (error || !data) return toast.error(error?.message ?? "Could not generate download link.");
    window.location.href = data.signedUrl;
  }

  async function doDelete() {
    setPending(true);
    const r = await deleteCandidateAndRedirect(candidate.id);
    if (!r?.ok) { setPending(false); return toast.error(r?.error ?? "Delete failed."); }
    toast.success("Candidate deleted.");
  }

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

      {/* Identity + actions in one row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Avatar + identity */}
        <div className="flex items-start gap-4">
          <Avatar className="h-20 w-20 shrink-0 ring-2 ring-border">
            <AvatarFallback className="text-xl">{initials(display.first_name, display.last_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-tight">{fullName}</h1>
            {display.current_company && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{display.current_company}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CategoryBadge value={candidate.category} />
              {stage && (
                <Badge
                  variant="outline"
                  className="border-current"
                  style={{ color: stage.color ?? "#a78bfa", borderColor: (stage.color ?? "#a78bfa") + "55" }}
                >
                  {stage.name}
                </Badge>
              )}
              {display.source && (
                <Badge variant="outline" className="text-muted-foreground">via {display.source}</Badge>
              )}
              {owner && (
                <Badge variant="outline" className="text-muted-foreground">
                  Owner: {owner.first_name ?? ""} {owner.last_name ?? ""}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions (all in one place) */}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
          <EditCandidateDrawer initial={candidate} />

          <Button variant="outline" size="sm" onClick={onPreviewResume} disabled={!resume}>
            <Eye className="mr-1 h-4 w-4" />{resume ? "Preview resume" : "No resume"}
          </Button>

          <Button variant="outline" size="sm" onClick={downloadResume} disabled={!resume}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>

          <Button variant="outline" size="sm" onClick={() => toast.info("Interview scheduling isn't enabled yet.")}>
            <CalendarPlus className="mr-1 h-4 w-4" /> Schedule
          </Button>

          <Button asChild variant="outline" size="sm" disabled={!email}>
            <a href={email ? `mailto:${email}` : undefined}>
              <Mail className="mr-1 h-4 w-4" /> Email
            </a>
          </Button>

          <Button variant="outline" size="sm" onClick={onAddNote}>
            <StickyNote className="mr-1 h-4 w-4" /> Add note
          </Button>

          {/* Pipeline stage move */}
          <StageMoveMenu applicationId={applicationId} currentStageId={currentStageId} stages={stages} />

          {/* Category move (talent pool / archive / duplicate) */}
          <MoveToMenu candidateIds={[candidate.id]} currentCategory={candidate.category} variant="button" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-rose-400 focus:text-rose-400">
                <Trash2 className="mr-2 h-4 w-4" /> Delete candidate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Meta strip */}
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {display.email && (
          <a href={`mailto:${display.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Mail className="h-4 w-4 shrink-0" /><span className="truncate">{display.email}</span>
          </a>
        )}
        {display.phone && (
          <a href={`tel:${display.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Phone className="h-4 w-4 shrink-0" />{display.phone}
          </a>
        )}
        {display.current_location && (
          <span className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />{display.current_location}
          </span>
        )}
        <span className="flex items-center gap-2 text-muted-foreground">
          <Briefcase className="h-4 w-4 shrink-0" />{expYears}y {expMonths}m experience
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />Applied {formatDate(appliedAt)}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />Updated {formatDate(display.updated_at)}
        </span>

        {(display.linkedin_url || display.github_url || display.portfolio_url) && (
          <div className="col-span-full mt-1 flex items-center gap-3">
            {display.linkedin_url && (
              <a href={display.linkedin_url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </a>
            )}
            {display.github_url && (
              <a href={display.github_url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="GitHub">
                <Github className="h-4 w-4" />
              </a>
            )}
            {display.portfolio_url && (
              <a href={display.portfolio_url} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Portfolio">
                <Globe className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${display.first_name} ${display.last_name ?? ""}?`}
        description="This permanently removes the candidate and every application, interview, feedback note, document, and message tied to them. This cannot be undone."
        confirmLabel="Delete candidate"
        destructive
        pending={pending}
        onConfirm={doDelete}
      />
    </div>
  );
}
