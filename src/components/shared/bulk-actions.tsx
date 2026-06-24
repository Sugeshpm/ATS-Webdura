"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface Props {
  /** Resource being managed. */
  kind: "jobs" | "candidates";
  /** Optional query string appended to the export URL (e.g. `?status=active&job=…`). */
  exportQuery?: string;
}

export function BulkActions({ kind, exportQuery = "" }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ inserted: number; skipped: number; failures?: string[] } | null>(null);

  async function upload(file: File) {
    setPending(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/${kind}/import`, { method: "POST", body: fd });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      toast.error(data.error ?? "Import failed.");
      if (data.details?.length) setResult({ inserted: 0, skipped: 0, failures: data.details });
      return;
    }
    setResult(data);
    toast.success(`Imported ${data.inserted}. Skipped ${data.skipped}.`);
    router.refresh();
  }

  const label = kind === "jobs" ? "Jobs" : "Candidates";

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/api/${kind}/export${exportQuery}`}>
          <Download className="mr-1 h-4 w-4" /> Export
        </a>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk import {label.toLowerCase()}</DialogTitle>
            <DialogDescription>Upload a CSV. New rows are inserted; nothing is deleted.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <a
              href={`/api/${kind}/template`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <FileText className="h-3.5 w-3.5" /> Download CSV template
            </a>

            <label className="block">
              <span className="block text-sm font-medium">CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={pending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
                className="mt-1 block w-full rounded-md border border-input bg-transparent text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:bg-secondary/70"
              />
            </label>

            {pending && <p className="text-xs text-muted-foreground">Uploading & inserting…</p>}

            {result && (
              <div className="rounded-md border border-border p-3 text-sm">
                <div>Inserted: <span className="font-medium text-emerald-300">{result.inserted}</span></div>
                <div>Skipped: <span className="font-medium text-amber-300">{result.skipped}</span></div>
                {result.failures?.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Show {result.failures.length} reason{result.failures.length === 1 ? "" : "s"}</summary>
                    <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                      {result.failures.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </details>
                ) : null}
              </div>
            )}

            {kind === "candidates" && (
              <p className="text-[11px] text-muted-foreground">
                Each row needs a <code>job_title</code> matching an existing job. Default stage is <code>Sourced</code>.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
