"use client";
import * as React from "react";
import { Trash2, Eye, Download, CalendarPlus, Mail, StickyNote, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { EditCandidateDrawer } from "@/components/candidates/edit-candidate-drawer";
import type { CandidateInitial } from "@/components/candidates/edit-candidate-drawer";
import { MoveToMenu } from "@/components/candidates/move-to-menu";
import { CategoryBadge } from "@/components/candidates/candidate-table";
import { deleteCandidateAndRedirect, type CandidateCategory } from "@/app/(app)/candidates/actions";

interface Resume {
  id: string;
  name: string;
  mime: string | null;
  storage_bucket: string;
  storage_path: string;
}

interface Props {
  candidate: CandidateInitial & { category: CandidateCategory };
  email: string | null;
  resume: Resume | null;
  onAddNote: () => void;
  onPreviewResume: () => void;
}

export function CandidateActionBar({ candidate, email, resume, onAddNote, onPreviewResume }: Props) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, setPending] = React.useState(false);

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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
      {/* Category badge — clearly shows current state */}
      <CategoryBadge value={candidate.category} />

      <EditCandidateDrawer initial={candidate} />

      <Button variant="outline" size="sm" onClick={onPreviewResume} disabled={!resume}>
        <Eye className="mr-1 h-4 w-4" />{resume ? "Preview resume" : "No resume"}
      </Button>

      <Button variant="outline" size="sm" onClick={downloadResume} disabled={!resume}>
        <Download className="mr-1 h-4 w-4" /> Download
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => toast.info("Interview scheduling isn't enabled yet.")}
      >
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

      {/* Move to category — replaces single Archive button */}
      <MoveToMenu
        candidateIds={[candidate.id]}
        currentCategory={candidate.category}
        variant="button"
      />

      <div className="ml-auto flex items-center gap-2">
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

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${candidate.first_name} ${candidate.last_name ?? ""}?`}
        description="This permanently removes the candidate and every application, interview, feedback note, document, and message tied to them. This cannot be undone."
        confirmLabel="Delete candidate"
        destructive
        pending={pending}
        onConfirm={doDelete}
      />
    </div>
  );
}
