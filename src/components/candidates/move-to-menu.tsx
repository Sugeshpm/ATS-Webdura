"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightCircle, Users, Archive, Copy, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  moveCandidateCategory,
  moveCandidatesCategory,
  type CandidateCategory
} from "@/app/(app)/candidates/actions";

const OPTIONS: { value: CandidateCategory; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: "active",      label: "Active candidates", icon: CheckCircle2, description: "Move back into the active hiring workflow." },
  { value: "talent_pool", label: "Talent Pool",       icon: Users,        description: "Park for future opportunities; remains searchable." },
  { value: "archived",    label: "Archived",          icon: Archive,      description: "Hide from active views. Restorable any time." },
  { value: "duplicate",   label: "Duplicates",        icon: Copy,         description: "Mark as a duplicate profile for review." }
];

interface Props {
  /** A single candidate or a set. */
  candidateIds: string[];
  /** Optional current category — used to grey out the matching option. */
  currentCategory?: CandidateCategory;
  /** "row" (smaller) | "button" (full) | "icon" (icon-only) — visual variant. */
  variant?: "row" | "button" | "icon";
  /** Optional callback after a successful move (e.g. clear selection on the bulk bar). */
  onMoved?: () => void;
}

export function MoveToMenu({ candidateIds, currentCategory, variant = "button", onMoved }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ open: boolean; target: CandidateCategory | null }>({ open: false, target: null });

  const isBulk = candidateIds.length > 1;
  const label = isBulk ? `Move ${candidateIds.length} to…` : "Move to…";

  async function doMove(to: CandidateCategory) {
    setPending(true);
    const res = candidateIds.length === 1
      ? await moveCandidateCategory(candidateIds[0], to)
      : await moveCandidatesCategory(candidateIds, to);
    setPending(false);

    if (!res.ok) { toast.error(res.error ?? "Move failed."); return; }

    const display = OPTIONS.find((o) => o.value === to)?.label ?? to;
    toast.success(isBulk
      ? `Moved ${"moved" in res ? res.moved : candidateIds.length} candidate(s) to ${display}.`
      : `Moved to ${display}.`);
    setConfirm({ open: false, target: null });
    onMoved?.();
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Move to…">
              <ArrowRightCircle className="h-4 w-4" />
            </button>
          ) : variant === "row" ? (
            <Button variant="ghost" size="sm" className="text-xs">
              <ArrowRightCircle className="mr-1 h-3.5 w-3.5" /> Move
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <ArrowRightCircle className="mr-1 h-4 w-4" /> {label} <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Move to category</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isCurrent = currentCategory === opt.value;
            return (
              <DropdownMenuItem
                key={opt.value}
                disabled={isCurrent}
                onSelect={(e) => { e.preventDefault(); setConfirm({ open: true, target: opt.value }); }}
                className="flex items-start gap-2"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                <div className="min-w-0">
                  <div className="text-sm">{opt.label}{isCurrent && <span className="ml-1 text-[10px] text-muted-foreground">(current)</span>}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{opt.description}</div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(o) => setConfirm((c) => ({ ...c, open: o }))}
        title={confirm.target ? confirmTitle(confirm.target, isBulk, candidateIds.length) : ""}
        description={confirm.target ? confirmDescription(confirm.target, isBulk) : ""}
        confirmLabel={confirm.target ? `Move to ${OPTIONS.find((o) => o.value === confirm.target)?.label}` : "Move"}
        pending={pending}
        onConfirm={() => confirm.target && doMove(confirm.target)}
      />
    </>
  );
}

function confirmTitle(target: CandidateCategory, bulk: boolean, n: number) {
  const dest = OPTIONS.find((o) => o.value === target)?.label ?? target;
  return bulk ? `Move ${n} candidates to ${dest}?` : `Move candidate to ${dest}?`;
}

function confirmDescription(target: CandidateCategory, bulk: boolean) {
  const base = bulk ? "These candidates" : "This candidate";
  switch (target) {
    case "active":      return `${base} will return to the active hiring pipeline and appear in default views.`;
    case "talent_pool": return `${base} will be parked for future opportunities. They remain searchable but won't be tied to current hiring workflows.`;
    case "archived":    return `${base} will be hidden from active views. You can restore them at any time.`;
    case "duplicate":   return `${base} will be marked as a duplicate profile. All data is preserved and restorable.`;
  }
}
