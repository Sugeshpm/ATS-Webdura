"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Eye, Download, CalendarPlus, Mail, StickyNote, Archive, ArchiveRestore, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { EditCandidateDrawer } from "@/components/candidates/edit-candidate-drawer";
import type { CandidateInitial } from "@/components/candidates/edit-candidate-drawer";
import {
  archiveCandidate,
  unarchiveCandidate,
  deleteCandidateAndRedirect
} from "@/app/(app)/candidates/actions";

interface Resume {
  id: string;
  name: string;
  mime: string | null;
  storage_bucket: string;
  storage_path: string;
}

interface Props {
  candidate: CandidateInitial & { is_archived?: boolean };
  email: string | null;
  resume: Resume | null;
  onAddNote: () => void;
  onPreviewResume: () => void;
}

export function CandidateActionBar({ candidate, email, resume, onAddNote, onPreviewResume }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
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

  async function doArchive() {
    setPending(true);
    const r = candidate.is_archived ? await unarchiveCandidate(candidate.id) : await archiveCandidate(candidate.id);
    setPending(false);
    if (!r.ok) return toast.error(r.error ?? "Action failed.");
    toast.success(candidate.is_archived ? "Candidate restored." : "Candidate archived.");
    setConfirmArchive(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
      {/* Primary actions */}
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

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setConfirmArchive(true)}>
              {candidate.is_archived
                ? (<><ArchiveRestore className="mr-2 h-4 w-4" /> Restore from archive</>)
                : (<><Archive className="mr-2 h-4 w-4" /> Archive candidate</>)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={candidate.is_archived ? "Restore candidate from archive?" : "Archive this candidate?"}
        description={candidate.is_archived
          ? "They'll reappear in the main candidates list."
          : "Archived candidates are hidden from the default list but their data is preserved."}
        confirmLabel={candidate.is_archived ? "Restore" : "Archive"}
        pending={pending}
        onConfirm={doArchive}
      />
    </div>
  );
}
