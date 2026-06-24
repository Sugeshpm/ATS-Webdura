"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { formatDate, initials } from "@/lib/utils";
import { addNote, updateNote, deleteNote } from "@/app/(app)/candidates/actions";

export interface Note {
  id: string;
  body: string;
  created_at: string;
  author: { id?: string | null; first_name: string | null; last_name: string | null } | null;
}

interface Props {
  applicationId: string;
  currentUserId: string;
  notes: Note[];
  /** Auto-focus composer on mount (set by Action Bar's "Add note"). */
  autoFocus?: boolean;
}

const STICKY_TONES = [
  "from-amber-400/20 to-amber-500/10 border-amber-500/30",
  "from-emerald-400/20 to-emerald-500/10 border-emerald-500/30",
  "from-sky-400/20 to-sky-500/10 border-sky-500/30",
  "from-rose-400/20 to-rose-500/10 border-rose-500/30",
  "from-violet-400/20 to-violet-500/10 border-violet-500/30",
  "from-orange-400/20 to-orange-500/10 border-orange-500/30"
];

export function NotesTab({ applicationId, currentUserId, notes, autoFocus }: Props) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { if (autoFocus) composerRef.current?.focus(); }, [autoFocus]);

  async function submitNew() {
    if (!body.trim()) return;
    setPending(true);
    const r = await addNote(applicationId, body);
    setPending(false);
    if (!r.ok) return toast.error(r.error ?? "Failed to add note.");
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Composer */}
      <div className="rounded-xl border border-border bg-card p-4">
        <Textarea
          ref={composerRef}
          placeholder="Share your thoughts and notes here…"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitNew(); }}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Tip: ⌘/Ctrl + Enter to post</p>
          <Button size="sm" onClick={submitNew} disabled={pending || !body.trim()}>
            {pending ? "Posting…" : "Post note"}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No notes yet. Capture context, feedback, or follow-ups above.
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {notes.map((n, i) => (
            <NoteCard
              key={n.id}
              note={n}
              tone={STICKY_TONES[i % STICKY_TONES.length]}
              canEdit={n.author?.id === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, tone, canEdit }: { note: Note; tone: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(note.body);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function save() {
    setPending(true);
    const r = await updateNote(note.id, draft);
    setPending(false);
    if (!r.ok) return toast.error(r.error ?? "Failed to update.");
    setEditing(false);
    router.refresh();
  }

  async function doDelete() {
    setPending(true);
    const r = await deleteNote(note.id);
    setPending(false);
    if (!r.ok) return toast.error(r.error ?? "Failed to delete.");
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <article className={`mb-4 break-inside-avoid rounded-lg border bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[9px]">{initials(note.author?.first_name, note.author?.last_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-xs">
            <div className="truncate font-medium">{note.author?.first_name} {note.author?.last_name}</div>
            <div className="text-[10px] text-muted-foreground">{formatDate(note.created_at, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setConfirmOpen(true)} className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-300" aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(note.body); }} disabled={pending}>
              <X className="mr-1 h-3 w-3" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending || !draft.trim()}>
              <Check className="mr-1 h-3 w-3" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this note?"
        description="The note will be permanently removed."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={doDelete}
      />
    </article>
  );
}
