"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import { JobCard } from "@/components/jobs/job-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { deleteJobs } from "@/app/(app)/jobs/actions";

type Job = React.ComponentProps<typeof JobCard>["job"] & { id: string };

export function JobsGrid({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function clear() { setSelected(new Set()); }

  async function bulkDelete() {
    setPending(true);
    const result = await deleteJobs(Array.from(selected));
    setPending(false);
    if (!result.ok) return toast.error(result.error ?? "Delete failed.");
    toast.success(`Deleted ${result.deleted} job${result.deleted === 1 ? "" : "s"}.`);
    setConfirmOpen(false);
    clear();
    router.refresh();
  }

  if (!jobs.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No jobs match. Create one or change the filters.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {jobs.map((job) => {
          const isChecked = selected.has(job.id);
          return (
            <div key={job.id} className="group relative">
              <JobCard job={job} />
              <div
                className={`absolute left-3 top-3 z-10 transition-opacity ${isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-background/90 ring-1 ring-border">
                  <Checkbox checked={isChecked} onCheckedChange={() => toggle(job.id)} aria-label="Select job" />
                </div>
              </div>
            </div>
          );
        })}
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
        title={`Delete ${selected.size} job${selected.size === 1 ? "" : "s"}?`}
        description="All linked applications, stage history, interviews, feedback, messages, and notes will be deleted too. This cannot be undone."
        confirmLabel="Delete jobs"
        destructive
        pending={pending}
        onConfirm={bulkDelete}
      />
    </>
  );
}
