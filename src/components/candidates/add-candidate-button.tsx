"use client";
import * as React from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AddCandidateForm } from "./add-candidate-form";

interface Props {
  jobs: { id: string; title: string }[];
  stages: { id: string; name: string; code: string }[];
}

export function AddCandidateButton({ jobs, stages }: Props) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Add Candidate <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[520px] max-w-full">
        <SheetHeader>
          <SheetTitle>Add Candidate</SheetTitle>
        </SheetHeader>
        <AddCandidateForm jobs={jobs} stages={stages} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
