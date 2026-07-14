"use client";
import * as React from "react";
import { MessageSquare, Send, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { formatDate, initials } from "@/lib/utils";
import { addNote, updateNote, deleteNote, listNotes } from "@/app/(app)/candidates/actions";

export interface QuickNote {
  id: string;
  body: string;
  created_at: string;
  author: { id: string | null; first_name: string | null; last_name: string | null } | null;
}

interface Props {
  applicationId: string | null;
  candidateName: string;
  currentUserId: string | null;
  /** Optional initial count for the icon badge (falls back to lazy fetch). */
  initialCount?: number;
}

/**
 * Row-level notes drawer. The trigger is an icon button — clicking opens a
 * right-side sheet that lazy-loads notes and supports add/edit/delete.
 * Nothing about the drawer causes a page navigation; all state is local +
 * optimistic + toast-driven.
 */
export function NotesQuickDrawer({ applicationId, candidateName, currentUserId, initialCount }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [notes, setNotes] = React.useState<QuickNote[]>([]);
  const [count, setCount] = React.useState<number | null>(initialCount ?? null);
  const [draft, setDraft] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  const disabled = !applicationId;

  async function refresh() {
    if (!applicationId) return;
    setLoading(true);
    const r = await listNotes(applicationId);
    setLoading(false);
    if (!r.ok) { toast.error(r.error ?? "Failed to load notes."); return; }
    setNotes(r.notes);
    setCount(r.notes.length);
  }

  function handleOpen(v: boolean) {
    setOpen(v);
    if (v) {
      // Fire-and-forget lazy fetch. Focus composer once the sheet has animated in.
      void refresh();
      setTimeout(() => composerRef.current?.focus(), 120);
    }
  }

  async function post() {
    if (!applicationId || !draft.trim()) return;
    setPosting(true);
    const r = await addNote(applicationId, draft);
    setPosting(false);
    if (!r.ok) { toast.error(r.error ?? "Failed to add note."); return; }
    setDraft("");
    toast.success("Note added.");
    await refresh();
  }

  return (
    <>
      <button
        type="button"
        title={disabled ? "Notes are attached to an application — this row has none" : `${candidateName} — notes`}
        aria-label="Open notes"
        onClick={() => !disabled && handleOpen(true)}
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
      >
        <MessageSquare className="h-4 w-4" />
        {typeof count === "number" && count > 0 && (
          <span className="ml-0.5 text-[10px] font-semibold tabular-nums">{count > 99 ? "99+" : count}</span>
        )}
      </button>

      <Sheet open={open} onOpenChange={handleOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle className="pr-8">Notes — {candidateName}</SheetTitle>
            <SheetDescription>
              Recruiter notes for this application. Newest first.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 rounded-lg border border-border bg-background p-3">
            <Textarea
              ref={composerRef}
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a note…"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void post(); }
              }}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>⌘/Ctrl + Enter to post</span>
              <Button size="sm" onClick={post} disabled={posting || !draft.trim()}>
                {posting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                Post
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notes…
              </div>
            ) : notes.length === 0 ? (
              <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No notes yet. Add the first one above.
              </div>
            ) : (
              notes.map((n) => (
                <NoteItem
                  key={n.id}
                  note={n}
                  canEdit={n.author?.id === currentUserId}
                  onChanged={refresh}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NoteItem({ note, canEdit, onChanged }: { note: QuickNote; canEdit: boolean; onChanged: () => Promise<void> | void }) {
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
    toast.success("Note updated.");
    await onChanged();
  }

  async function remove() {
    setPending(true);
    const r = await deleteNote(note.id);
    setPending(false);
    if (!r.ok) return toast.error(r.error ?? "Failed to delete.");
    setConfirmOpen(false);
    toast.success("Note deleted.");
    await onChanged();
  }

  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {initials(note.author?.first_name, note.author?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">
              {(note.author?.first_name ?? "") + " " + (note.author?.last_name ?? "") || "Unknown"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {formatDate(note.created_at, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setEditing(true)}
              title="Edit note"
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              title="Delete note"
              className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      {editing ? (
        <div className="mt-2 space-y-2">
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
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
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this note?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={remove}
      />
    </article>
  );
}
