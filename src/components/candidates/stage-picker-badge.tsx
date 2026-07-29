"use client";
import * as React from "react";
import { Check, ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { Badge, stageBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: string | null;
  currentStageId: string | null;
  currentStageName: string | null;
  /** For rejected candidates, the stage they were IN when rejected. Shown as "Rejected (Screening)". */
  rejectedFromStageName?: string | null;
  stages: { id: string; name: string }[];
}

// Preset rejection reasons — kept short. Recruiters can add free-text notes.
const REJECTION_REASONS: Array<{ code: string; label: string }> = [
  { code: "skills_gap",       label: "Skills gap" },
  { code: "experience_gap",   label: "Experience mismatch" },
  { code: "compensation",     label: "Compensation mismatch" },
  { code: "culture_fit",      label: "Culture fit" },
  { code: "location",         label: "Location constraint" },
  { code: "notice_period",    label: "Notice period too long" },
  { code: "communication",    label: "Communication skills" },
  { code: "failed_technical", label: "Failed technical round" },
  { code: "failed_hr",        label: "Failed HR round" },
  { code: "withdrew",         label: "Candidate withdrew" },
  { code: "position_closed",  label: "Position closed / on hold" },
  { code: "other",            label: "Other" }
];

export function StagePickerBadge({ applicationId, currentStageId, currentStageName, rejectedFromStageName, stages }: Props) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Optimistic local state so the badge updates immediately on success.
  const [stageId, setStageId] = React.useState<string | null>(currentStageId);
  const [stageName, setStageName] = React.useState<string | null>(currentStageName);
  const [rejectedFrom, setRejectedFrom] = React.useState<string | null>(rejectedFromStageName ?? null);

  // Modal state — shown when user is moving INTO Rejected.
  const [rejectDialog, setRejectDialog] = React.useState<{ nextId: string; nextName: string } | null>(null);
  const [reasonCode, setReasonCode] = React.useState<string>("skills_gap");
  const [rejectNotes, setRejectNotes] = React.useState("");

  const displayLabel = React.useMemo(() => {
    if (stageName?.toLowerCase() === "rejected" && rejectedFrom) {
      return `Rejected (${rejectedFrom})`;
    }
    return stageName;
  }, [stageName, rejectedFrom]);

  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!applicationId) {
    return stageName ? (
      <Badge variant={stageBadgeVariant(stageName)}>{displayLabel}</Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  async function performMove(nextId: string, nextName: string, reason?: string, notes?: string) {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("move_application_stage", {
      p_application_id: applicationId!,
      p_to_stage_id: nextId,
      p_comment: null,
      p_rejection_reason: reason ?? null,
      p_rejection_notes: notes ?? null
    });
    setPending(false);
    if (error) { toast.error(error.message); return; }

    // Optimistic local update
    const prevStageName = stageName;
    if (nextName.toLowerCase() === "rejected") {
      setRejectedFrom((prev) => prev ?? prevStageName ?? null);
    } else if (prevStageName?.toLowerCase() === "rejected") {
      setRejectedFrom(null);
    }
    setStageId(nextId);
    setStageName(nextName);
    setOpen(false);
    setRejectDialog(null);
    setRejectNotes("");
    toast.success(`Moved to ${nextName}${reason ? ` — ${prettyReason(reason)}` : ""}.`);
  }

  function pick(nextId: string) {
    if (nextId === stageId) { setOpen(false); return; }
    const next = stages.find((s) => s.id === nextId);
    if (!next) return;

    // Rejecting → open the reason dialog first
    if (next.name.toLowerCase() === "rejected") {
      setOpen(false);
      setRejectDialog({ nextId: next.id, nextName: next.name });
      return;
    }
    // Anything else → move immediately
    void performMove(nextId, next.name);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title={stageName?.toLowerCase() === "rejected" && rejectedFrom ? `Rejected during ${rejectedFrom}` : "Change stage"}
        aria-label="Change stage"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group inline-flex items-center gap-1 rounded-full transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 disabled:cursor-wait"
      >
        {stageName ? (
          <Badge variant={stageBadgeVariant(stageName)} className="cursor-pointer">
            {displayLabel}
            {pending
              ? <Loader2 className="ml-1 h-3 w-3 animate-spin" />
              : <ChevronDown className="ml-0.5 h-3 w-3 opacity-60 group-hover:opacity-100" />}
          </Badge>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
            Set stage <ChevronDown className="h-3 w-3" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 min-w-[13rem] rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {stages.map((s) => {
            const active = s.id === stageId;
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={active}
                onClick={() => pick(s.id)}
                disabled={pending}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition hover:bg-secondary/70",
                  active && "text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Badge variant={stageBadgeVariant(s.name)} className="text-[10px]">{s.name}</Badge>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Rejection reason modal */}
      <Dialog open={!!rejectDialog} onOpenChange={(v) => !v && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Reject candidate
            </DialogTitle>
            <DialogDescription>
              Optional but recommended — capture why this candidate isn&apos;t moving forward. Useful for reports and future re-outreach.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Reason</Label>
              <select
                id="rejection-reason"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                {REJECTION_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="rejection-notes">Notes (optional)</Label>
              <Textarea
                id="rejection-notes"
                rows={3}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="e.g. Strong basics, but couldn't demonstrate React hooks depth."
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setRejectDialog(null)} disabled={pending}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => rejectDialog && performMove(rejectDialog.nextId, rejectDialog.nextName, reasonCode, rejectNotes.trim() || undefined)}
              >
                {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Confirm rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function prettyReason(code: string): string {
  return REJECTION_REASONS.find((r) => r.code === code)?.label ?? code;
}
