"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";

interface Props {
  /** Application IDs to score. */
  applicationIds: string[];
  /** Called after a successful batch (client should clear selection + router.refresh). */
  onDone?: () => void;
}

/**
 * "Score with AI" bulk button. Reads the batch endpoint's NDJSON stream and
 * shows live progress in a modal. Same pattern as the CSV import UI.
 */
export function AIShortlistBulkButton({ applicationIds, onDone }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState({ shortlisted: 0, borderline: 0, not_shortlisted: 0, no_resume: 0, errors: 0 });
  const [cost, setCost] = React.useState(0);

  async function start() {
    if (!applicationIds.length || running) return;
    setOpen(true);
    setRunning(true);
    setDone(0);
    setTotal(applicationIds.length);
    setCounts({ shortlisted: 0, borderline: 0, not_shortlisted: 0, no_resume: 0, errors: 0 });
    setCost(0);

    try {
      const res = await fetch("/api/ai/shortlist/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ application_ids: applicationIds })
      });
      if (!res.ok || !res.body) {
        toast.error(`Batch failed with HTTP ${res.status}`);
        setRunning(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let localDone = 0;
      const localCounts = { shortlisted: 0, borderline: 0, not_shortlisted: 0, no_resume: 0, errors: 0 };
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "row") {
              localDone++;
              setDone(localDone);
              if (evt.status === "error") localCounts.errors++;
              else if (evt.verdict === "shortlisted") localCounts.shortlisted++;
              else if (evt.verdict === "borderline") localCounts.borderline++;
              else if (evt.verdict === "not_shortlisted") localCounts.not_shortlisted++;
              else if (evt.verdict === "no_resume") localCounts.no_resume++;
              setCounts({ ...localCounts });
            } else if (evt.type === "done") {
              setCost(Number(evt.cost_usd) || 0);
            }
          } catch { /* ignore malformed line */ }
        }
      }
      toast.success(`Scored ${localDone}/${applicationIds.length}. ${localCounts.shortlisted} shortlisted.`);
      onDone?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error.");
    } finally {
      setRunning(false);
    }
  }

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={start} disabled={running || !applicationIds.length}>
        {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
        Score with AI
      </Button>

      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scoring candidates</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            <Progress value={percent} />
            <p className="text-sm text-muted-foreground">
              {running ? `${done} of ${total} processed…` : `Finished ${done}/${total}.`}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Row label="Shortlisted"     n={counts.shortlisted}     tone="emerald" />
              <Row label="Borderline"      n={counts.borderline}      tone="amber" />
              <Row label="Not shortlisted" n={counts.not_shortlisted} tone="rose" />
              <Row label="No resume"       n={counts.no_resume}       tone="slate" />
              {counts.errors > 0 && <Row label="Errors" n={counts.errors} tone="rose" />}
            </div>
            {!running && cost > 0 && (
              <p className="text-[11px] text-muted-foreground">Est. cost: ${cost.toFixed(4)}</p>
            )}
            {!running && (
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, n, tone }: { label: string; n: number; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const cls = {
    emerald: "text-emerald-700 bg-emerald-500/10",
    amber:   "text-amber-700 bg-amber-500/10",
    rose:    "text-rose-700 bg-rose-500/10",
    slate:   "text-muted-foreground bg-secondary"
  }[tone];
  return (
    <div className={`flex items-center justify-between rounded px-2 py-1 ${cls}`}>
      <span>{label}</span>
      <span className="tabular-nums font-semibold">{n}</span>
    </div>
  );
}
