"use client";
import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Badge, stageBadgeVariant } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: string | null;
  currentStageId: string | null;
  currentStageName: string | null;
  stages: { id: string; name: string }[];
}

/**
 * Clickable stage badge. Opens a dropdown with all stages; picking one calls
 * the `move_application_stage` RPC and updates the badge in place — no page
 * refresh, no server round-trip back to Next.
 */
export function StagePickerBadge({ applicationId, currentStageId, currentStageName, stages }: Props) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Optimistic local state so the badge updates immediately on success.
  const [stageId, setStageId] = React.useState<string | null>(currentStageId);
  const [stageName, setStageName] = React.useState<string | null>(currentStageName);

  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // If the row somehow lacks an application (e.g. candidate-centric view with no apps),
  // show a static badge — nothing to move.
  if (!applicationId) {
    return stageName ? (
      <Badge variant={stageBadgeVariant(stageName)}>{stageName}</Badge>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  }

  async function pick(nextId: string) {
    if (nextId === stageId) { setOpen(false); return; }
    const next = stages.find((s) => s.id === nextId);
    if (!next) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("move_application_stage", {
      p_application_id: applicationId!,
      p_to_stage_id: nextId,
      p_comment: null
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Optimistic local update — no page refresh.
    setStageId(nextId);
    setStageName(next.name);
    setOpen(false);
    toast.success(`Moved to ${next.name}.`);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        title="Change stage"
        aria-label="Change stage"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group inline-flex items-center gap-1 rounded-full transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 disabled:cursor-wait"
      >
        {stageName ? (
          <Badge variant={stageBadgeVariant(stageName)} className="cursor-pointer">
            {stageName}
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
    </div>
  );
}
