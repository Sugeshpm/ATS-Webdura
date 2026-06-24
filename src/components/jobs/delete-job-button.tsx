"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { deleteJobAndRedirect } from "@/app/(app)/jobs/actions";

export function DeleteJobButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    const result = await deleteJobAndRedirect(jobId);
    if (!result?.ok) {
      setPending(false);
      toast.error(result?.error ?? "Failed to delete.");
      return;
    }
    toast.success("Job deleted.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1 h-4 w-4" /> Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete "${jobTitle}"?`}
        description="This permanently removes the job and all linked applications, stage history, interviews, feedback, messages, and notes. This cannot be undone."
        confirmLabel="Delete job"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
