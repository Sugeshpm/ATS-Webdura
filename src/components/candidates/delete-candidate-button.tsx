"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { deleteCandidateAndRedirect } from "@/app/(app)/candidates/actions";

export function DeleteCandidateButton({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    const result = await deleteCandidateAndRedirect(candidateId);
    if (!result?.ok) {
      setPending(false);
      toast.error(result?.error ?? "Delete failed.");
      return;
    }
    toast.success("Candidate deleted.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1 h-4 w-4" /> Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${candidateName}?`}
        description="This permanently removes the candidate and every application, interview, feedback note, document, and message tied to them. This cannot be undone."
        confirmLabel="Delete candidate"
        destructive
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
