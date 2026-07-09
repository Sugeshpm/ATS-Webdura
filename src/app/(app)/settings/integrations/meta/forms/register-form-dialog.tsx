"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerMetaForm } from "../actions";

interface Props {
  jobs: { id: string; title: string }[];
  knownPages: { id: string; name: string | null }[];
}

export function RegisterFormDialog({ jobs, knownPages }: Props) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Register form
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a Meta Lead form</DialogTitle>
          <DialogDescription>
            Grab Page ID + Form ID from{" "}
            <a href="https://business.facebook.com/instant-forms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Instant Forms
            </a>. Paste a long-lived Page Access Token.
          </DialogDescription>
        </DialogHeader>
        <form action={registerMetaForm} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="page_id">Page ID *</Label>
              {knownPages.length > 0 ? (
                <>
                  <select
                    id="page_id"
                    name="page_id"
                    required
                    defaultValue={knownPages[0]?.id ?? ""}
                    className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm"
                  >
                    {knownPages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                    ))}
                    <option value="">— Enter another below</option>
                  </select>
                  <Input name="page_id" placeholder="Or paste a different Page ID" />
                </>
              ) : (
                <Input id="page_id" name="page_id" required placeholder="123456789012345" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page_name">Page name (optional)</Label>
              <Input id="page_name" name="page_name" placeholder="Webdura Careers" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="form_id">Form ID *</Label>
              <Input id="form_id" name="form_id" required placeholder="987654321098765" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form_name">Form name (optional)</Label>
              <Input id="form_name" name="form_name" placeholder="Frontend Developer — Nov 2026" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job_id">Applies to job (optional)</Label>
            <select id="job_id" name="job_id" defaultValue="" className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm">
              <option value="">— Unassigned (candidate only)</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">
              When set, every lead creates an application at the &quot;Sourced&quot; stage on this job.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="token">Page Access Token *</Label>
            <Input id="token" name="token" type="password" required placeholder="EAAG…" autoComplete="off" />
            <p className="text-[11px] text-muted-foreground">Encrypted at rest with AES-256-GCM.</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Save form</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
