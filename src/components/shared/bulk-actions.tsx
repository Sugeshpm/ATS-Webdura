"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileText, CheckCircle2, XCircle, AlertTriangle, FileDown } from "lucide-react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";

interface Props {
  kind: "jobs" | "candidates";
  exportQuery?: string;
}

interface FailedRow {
  index: number;
  name: string;
  status: "skip" | "fail";
  reason: string;
}

interface FinalResult {
  inserted: number;
  skipped: number;
  resumes_uploaded?: number;
  total?: number;
}

type Phase = "idle" | "uploading" | "streaming" | "done" | "error";

export function BulkActions({ kind, exportQuery = "" }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [progress, setProgress] = React.useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [currentName, setCurrentName] = React.useState<string>("");
  const [result, setResult] = React.useState<FinalResult | null>(null);
  const [failedRows, setFailedRows] = React.useState<FailedRow[]>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);

  function reset() {
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
    setCurrentName("");
    setResult(null);
    setFailedRows([]);
    setErrorMsg(null);
    setUploadedFile(null);
  }

  async function upload(file: File) {
    reset();
    setPhase("uploading");
    setUploadedFile(file);

    const fd = new FormData();
    fd.append("file", file);

    let res: Response;
    try {
      res = await fetch(`/api/${kind}/import`, { method: "POST", body: fd });
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Network error.");
      toast.error("Import request failed.");
      return;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("ndjson")) {
      const data = await res.json().catch(() => ({} as { error?: string; details?: string[] }));
      setPhase("error");
      setErrorMsg(data.error ?? "Import failed.");
      if (data.details?.length) {
        setFailedRows(data.details.map((r, i) => ({ index: i, name: `Row ${i + 1}`, status: "fail", reason: r })));
      }
      toast.error(data.error ?? "Import failed.");
      return;
    }

    if (!res.body) {
      setPhase("error");
      setErrorMsg("Empty response.");
      return;
    }

    setPhase("streaming");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            handleEvent(JSON.parse(line));
          } catch {
            /* ignore malformed lines */
          }
        }
      }
    } catch (e) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Stream broken.");
      toast.error("Import interrupted.");
    }
  }

  function handleEvent(evt: { type: string; [k: string]: unknown }) {
    if (evt.type === "start") {
      setProgress({ done: 0, total: Number(evt.total) || 0 });
    } else if (evt.type === "row") {
      const idx = Number(evt.index) || 0;
      setProgress((p) => ({ done: idx + 1, total: p.total || idx + 1 }));
      if (typeof evt.name === "string") setCurrentName(evt.name);
      if (evt.status === "skip" || evt.status === "fail") {
        setFailedRows((prev) => [
          ...prev,
          {
            index: idx,
            name: String(evt.name ?? `Row ${idx + 1}`),
            status: evt.status as "skip" | "fail",
            reason: String(evt.reason ?? "Unknown reason")
          }
        ]);
      }
    } else if (evt.type === "done") {
      const final: FinalResult = {
        inserted: Number(evt.inserted) || 0,
        skipped: Number(evt.skipped) || 0,
        resumes_uploaded: typeof evt.resumes_uploaded === "number" ? evt.resumes_uploaded : undefined,
        total: Number(evt.total) || 0
      };
      setResult(final);
      setPhase("done");
      setProgress((p) => ({ done: p.total, total: p.total }));
      toast.success(`Imported ${final.inserted} · Skipped ${final.skipped}${
        typeof final.resumes_uploaded === "number" ? ` · Resumes: ${final.resumes_uploaded}` : ""
      }`);
      router.refresh();
    }
  }

  /** Re-parse the original CSV, keep only failed row indexes, add a failure_reason column. */
  async function downloadFailedRows() {
    if (!uploadedFile || failedRows.length === 0) return;
    const text = await uploadedFile.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const originalRows = parsed.data ?? [];
    const headers = parsed.meta.fields ?? Object.keys(originalRows[0] ?? {});

    const reasonByIndex = new Map(failedRows.map((f) => [f.index, f.reason]));
    const failedIndexes = failedRows.map((f) => f.index).sort((a, b) => a - b);

    const outRows = failedIndexes.map((i) => {
      const row = originalRows[i] ?? {};
      return { ...row, failure_reason: reasonByIndex.get(i) ?? "" };
    });

    const csv = Papa.unparse({
      fields: [...headers, "failure_reason"],
      data: outRows.map((r) => [...headers.map((h) => r[h] ?? ""), r.failure_reason ?? ""])
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const base = uploadedFile.name.replace(/\.csv$/i, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-failed-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const label = kind === "jobs" ? "Jobs" : "Candidates";
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const isBusy = phase === "uploading" || phase === "streaming";

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/api/${kind}/export${exportQuery}`}>
          <Download className="mr-1 h-4 w-4" /> Export
        </a>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="mr-1 h-4 w-4" /> Import
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk import {label.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Upload a CSV. New rows are inserted; nothing is deleted.
              {kind === "candidates" && " Resume paths in the CSV are uploaded to Storage."}
            </DialogDescription>
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
                disabled={isBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                }}
                className="mt-1 block w-full rounded-md border border-input bg-transparent text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:bg-secondary/70"
              />
            </label>

            {/* Progress area */}
            {isBusy && (
              <div className="rounded-md border border-border bg-surface-sunken p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {phase === "uploading" ? "Uploading…" : `Processing rows`}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {progress.total > 0 ? `${progress.done} / ${progress.total} (${pct}%)` : "…"}
                  </span>
                </div>
                <Progress value={progress.total > 0 ? pct : null} className="mt-2" />
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{uploadedFile?.name}</span>
                  {currentName && <span className="truncate italic">→ {currentName}</span>}
                </div>
                {failedRows.length > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> {failedRows.length} row{failedRows.length === 1 ? "" : "s"} failed so far
                  </div>
                )}
              </div>
            )}

            {/* Success */}
            {phase === "done" && result && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-semibold">Import complete</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-900/90">
                  <div>Inserted: <span className="font-semibold">{result.inserted}</span></div>
                  <div>Skipped: <span className="font-semibold">{result.skipped}</span></div>
                  {typeof result.resumes_uploaded === "number" && (
                    <div className="col-span-2">Resumes uploaded: <span className="font-semibold">{result.resumes_uploaded}</span></div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {failedRows.length > 0 && !!uploadedFile && (
                    <Button size="sm" variant="outline" onClick={downloadFailedRows}>
                      <FileDown className="mr-1 h-3.5 w-3.5" /> Download {failedRows.length} failed row{failedRows.length === 1 ? "" : "s"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
                </div>
              </div>
            )}

            {/* Failed rows panel — shown whenever we have any failures, in success OR error phase */}
            {(phase === "done" || phase === "error") && failedRows.length > 0 && (
              <FailedRowsPanel
                rows={failedRows}
                canDownload={!!uploadedFile}
                onDownload={downloadFailedRows}
              />
            )}

            {/* Error */}
            {phase === "error" && (
              <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                <div className="flex items-center gap-2 text-rose-700">
                  <XCircle className="h-4 w-4" />
                  <span className="font-semibold">Import failed</span>
                </div>
                {errorMsg && <p className="mt-1 text-xs">{errorMsg}</p>}
              </div>
            )}

            {kind === "candidates" && phase === "idle" && (
              <p className="text-[11px] text-muted-foreground">
                Each row needs a <code>job_title</code> matching an existing job. Default stage is <code>Sourced</code>.
                Optional <code>Resume</code> column with a path under <code>public/Resumes/</code> uploads the file.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FailedRowsPanel({
  rows, canDownload, onDownload
}: {
  rows: FailedRow[];
  canDownload: boolean;
  onDownload: () => void;
}) {
  // Group by reason for a quick summary
  const summary = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.reason, (m.get(r.reason) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            {rows.length} row{rows.length === 1 ? "" : "s"} not imported
          </span>
        </div>
        {canDownload && (
          <Button size="sm" variant="outline" onClick={onDownload} className="border-amber-400 bg-white hover:bg-amber-100">
            <FileDown className="mr-1 h-3.5 w-3.5" /> Download failed rows (.csv)
          </Button>
        )}
      </div>

      {/* Reason summary */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {summary.slice(0, 6).map(([reason, count]) => (
          <span key={reason} className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] text-amber-800">
            <span className="font-semibold">{count}</span> · {truncate(reason, 60)}
          </span>
        ))}
      </div>

      {/* Full list — scrollable */}
      <div className="mt-3 max-h-64 overflow-auto rounded border border-amber-200 bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-amber-100/80 backdrop-blur">
            <tr className="text-left text-amber-800">
              <th className="px-2.5 py-1.5 font-semibold">Row</th>
              <th className="px-2.5 py-1.5 font-semibold">Name</th>
              <th className="px-2.5 py-1.5 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {rows.map((r) => (
              <tr key={`${r.index}-${r.reason}`}>
                <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-amber-900/70">{r.index + 1}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 font-medium text-amber-900">{r.name}</td>
                <td className="px-2.5 py-1.5 text-amber-900/80">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-amber-700">
        Fix the flagged rows in the downloaded CSV (the <code>failure_reason</code> column shows what to correct), delete the <code>failure_reason</code> column, then re-upload.
      </p>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
