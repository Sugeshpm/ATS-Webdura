"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Mail, Phone, Trash2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { formatDate, initials } from "@/lib/utils";
import { deleteCandidates } from "@/app/(app)/candidates/actions";

export type CandidateRow = {
  application_id: string;
  candidate_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  stage_name: string | null;
  experience_years: number | null;
  experience_months: number | null;
  applied_at: string;
  updated_at: string;
  source: string | null;
  email: string | null;
  phone: string | null;
  preferred_location: string | null;
  current_company: string | null;
  gender: string | null;
};

export function CandidateTable({ rows }: { rows: CandidateRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.candidate_id)));
  }
  function clear() { setSelected(new Set()); }

  async function bulkDelete() {
    setPending(true);
    const result = await deleteCandidates(Array.from(selected));
    setPending(false);
    if (!result.ok) return toast.error(result.error ?? "Delete failed.");
    toast.success(`Deleted ${result.deleted} candidate${result.deleted === 1 ? "" : "s"}.`);
    setConfirmOpen(false);
    clear();
    router.refresh();
  }

  if (!rows.length) {
    return (
      <div className="rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No candidates yet. Click <span className="font-medium text-foreground">+ Add Candidate</span> to get started.
      </div>
    );
  }

  const allChecked = selected.size === rows.length && rows.length > 0;

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/50 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <Th className="w-8 pl-3">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
              </Th>
              <Th>Candidate name</Th>
              <Th>Job title</Th>
              <Th>Stage</Th>
              <Th>Experience</Th>
              <Th>Last updated</Th>
              <Th>Source</Th>
              <Th>Application date</Th>
              <Th>Previous company</Th>
              <Th>Preferred location</Th>
              <Th>Gender</Th>
              <Th>Contact</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.application_id} className="border-t border-border hover:bg-secondary/30">
                <Td className="pl-3">
                  <Checkbox checked={selected.has(r.candidate_id)} onCheckedChange={() => toggle(r.candidate_id)} aria-label="Select row" />
                </Td>
                <Td>
                  <Link href={`/candidates/${r.application_id}`} className="flex items-center gap-2 hover:underline">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">{initials(r.first_name, r.last_name)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{r.first_name} {r.last_name ?? ""}</span>
                  </Link>
                </Td>
                <Td>{r.job_title ?? "—"}</Td>
                <Td>{r.stage_name ? <Badge>{r.stage_name}</Badge> : "—"}</Td>
                <Td>{r.experience_years ?? 0}y {r.experience_months ?? 0}m</Td>
                <Td>{formatDate(r.updated_at)}</Td>
                <Td>{r.source ?? "—"}</Td>
                <Td>{formatDate(r.applied_at)}</Td>
                <Td>{r.current_company ?? "Not Available"}</Td>
                <Td>{r.preferred_location ?? "Not Available"}</Td>
                <Td>{r.gender ?? "—"}</Td>
                <Td>
                  <div className="flex flex-col gap-0.5 text-xs">
                    {r.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                    {r.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>}
                  </div>
                </Td>
                <Td><button className="rounded p-1 hover:bg-secondary" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
          <span className="text-sm">{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={clear} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete selected
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selected.size} candidate${selected.size === 1 ? "" : "s"}?`}
        description="Every linked application, interview, feedback note, document, and message will be removed too. This cannot be undone."
        confirmLabel="Delete candidates"
        destructive
        pending={pending}
        onConfirm={bulkDelete}
      />
    </>
  );
}

function Th({ className, children }: React.HTMLAttributes<HTMLTableCellElement>) {
  return <th className={"whitespace-nowrap px-3 py-2 text-left font-semibold " + (className ?? "")}>{children}</th>;
}
function Td({ className, children }: React.HTMLAttributes<HTMLTableCellElement>) {
  return <td className={"whitespace-nowrap px-3 py-2 " + (className ?? "")}>{children}</td>;
}
