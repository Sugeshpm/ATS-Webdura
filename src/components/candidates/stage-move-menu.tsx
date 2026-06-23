"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: string;
  currentStageId: string | null;
  stages: { id: string; name: string }[];
}

export function StageMoveMenu({ applicationId, currentStageId, stages }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(currentStageId);
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const current = stages.find((s) => s.id === currentStageId);

  async function move() {
    if (!selected || selected === currentStageId) { setOpen(false); return; }
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("move_application_stage", {
      p_application_id: applicationId,
      p_to_stage_id: selected,
      p_comment: comment || null
    });
    setPending(false);
    if (error) return toast.error(error.message);
    toast.success("Stage updated.");
    setOpen(false);
    setComment("");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-secondary/30 px-3 text-sm"
      >
        {current?.name ?? "Set stage"} <ChevronDown className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border border-border bg-popover p-3 shadow-lg">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select stage to move</div>
          <ul className="mt-2 space-y-0.5 max-h-80 overflow-y-auto">
            {stages.map((s) => (
              <li key={s.id}>
                <label className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary/50",
                  s.id === currentStageId && "text-muted-foreground"
                )}>
                  <input
                    type="radio"
                    name="stage"
                    checked={selected === s.id}
                    onChange={() => setSelected(s.id)}
                    disabled={s.id === currentStageId}
                  />
                  <span>{s.name}{s.id === currentStageId && " (Current Stage)"}</span>
                </label>
              </li>
            ))}
          </ul>
          <Textarea
            placeholder="Write comment (optional)"
            rows={2}
            className="mt-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={move} disabled={pending}>Move</Button>
          </div>
        </div>
      )}
    </div>
  );
}
