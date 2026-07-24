"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Check, X, MinusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils";

type Verdict = "shortlisted" | "borderline" | "not_shortlisted" | "no_resume" | "error";

export interface AIShortlistInitial {
  ai_status: Verdict | null;
  ai_score: number | null;
  ai_evaluated_at: string | null;
  latest: {
    summary: string | null;
    strengths: string[];
    gaps: string[];
    model: string;
    created_at: string;
  } | null;
}

interface Props {
  applicationId: string;
  initial: AIShortlistInitial;
}

/**
 * Compact panel showing the AI shortlist verdict for a candidate + a button to
 * run/re-run. Sits in the candidate detail page's summary slot.
 *
 * The initial state is server-rendered so recruiters see the verdict without
 * an extra fetch. Running / re-running is a POST + optimistic UI + toast.
 */
export function AIShortlistPanel({ applicationId, initial }: Props) {
  const router = useRouter();
  const [state, setState] = React.useState(initial);
  const [running, setRunning] = React.useState(false);

  async function run(force: boolean) {
    setRunning(true);
    try {
      const res = await fetch(`/api/ai/shortlist/${applicationId}${force ? "?force=1" : ""}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.status === "error" || data.status === "skipped") {
        toast.error(data.error ?? "AI evaluation failed.");
        return;
      }
      // Optimistic update.
      setState({
        ai_status: data.verdict,
        ai_score: data.score,
        ai_evaluated_at: new Date().toISOString(),
        latest: {
          summary: data.summary ?? null,
          strengths: data.strengths ?? [],
          gaps: data.gaps ?? [],
          model: state.latest?.model ?? "claude-haiku-4-5-20251001",
          created_at: new Date().toISOString()
        }
      });
      toast.success(
        data.status === "cached"
          ? `Reused a recent evaluation (${data.score}).`
          : `Scored ${data.score} — ${prettyVerdict(data.verdict)}.`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error.");
    } finally {
      setRunning(false);
    }
  }

  const hasResult = state.ai_status && state.ai_status !== "no_resume" && state.ai_status !== "error" && state.ai_score !== null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">AI shortlist</h3>
            <p className="text-[11px] text-muted-foreground">
              {state.ai_evaluated_at
                ? `Evaluated ${formatDate(state.ai_evaluated_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Not yet evaluated"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasResult ? (
            <Button size="sm" variant="ghost" onClick={() => run(true)} disabled={running} title="Re-run evaluation">
              {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
              Re-run
            </Button>
          ) : (
            <Button size="sm" onClick={() => run(false)} disabled={running}>
              {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              Score with AI
            </Button>
          )}
        </div>
      </header>

      {state.ai_status === "no_resume" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Candidate has no resume on file — upload one to score them.
        </p>
      )}
      {state.ai_status === "error" && (
        <p className="mt-3 text-xs text-rose-600">
          Last evaluation failed. Click Re-run to try again.
        </p>
      )}

      {hasResult && (
        <>
          <div className="mt-4 flex items-center gap-4">
            <ScoreDial score={state.ai_score!} verdict={state.ai_status as Verdict} />
            <div className="min-w-0 flex-1">
              <VerdictBadge verdict={state.ai_status as Verdict} />
              {state.latest?.summary && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{state.latest.summary}</p>
              )}
            </div>
          </div>

          {(state.latest?.strengths?.length || state.latest?.gaps?.length) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {state.latest?.strengths?.length ? (
                <div>
                  <h4 className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    <TrendingUp className="h-3 w-3" /> Strengths
                  </h4>
                  <ul className="space-y-0.5 text-xs text-foreground/80">
                    {state.latest.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {state.latest?.gaps?.length ? (
                <div>
                  <h4 className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> Gaps
                  </h4>
                  <ul className="space-y-0.5 text-xs text-foreground/80">
                    {state.latest.gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <MinusCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function prettyVerdict(v: Verdict): string {
  switch (v) {
    case "shortlisted": return "Shortlisted";
    case "borderline": return "Borderline";
    case "not_shortlisted": return "Not shortlisted";
    case "no_resume": return "No resume on file";
    case "error": return "Error";
  }
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const map: Record<Verdict, { label: string; className: string }> = {
    shortlisted:     { label: "AI Shortlisted",  className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    borderline:      { label: "Borderline",      className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
    not_shortlisted: { label: "Not shortlisted", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
    no_resume:       { label: "No resume",       className: "bg-secondary text-muted-foreground border-border" },
    error:           { label: "Error",           className: "bg-rose-500/10 text-rose-700 border-rose-500/30" }
  };
  const b = map[verdict];
  return <Badge className={cn("inline-flex", b.className)} variant="outline">{b.label}</Badge>;
}

function ScoreDial({ score, verdict }: { score: number; verdict: Verdict }) {
  const color =
    verdict === "shortlisted" ? "text-emerald-600" :
    verdict === "borderline"  ? "text-amber-600" :
    "text-rose-600";
  const bg =
    verdict === "shortlisted" ? "bg-emerald-500/10 ring-emerald-500/30" :
    verdict === "borderline"  ? "bg-amber-500/10 ring-amber-500/30" :
    "bg-rose-500/10 ring-rose-500/30";
  return (
    <div className={cn("flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full ring-2", bg)}>
      <span className={cn("text-xl font-bold tabular-nums", color)}>{score}</span>
      <span className={cn("text-[9px] uppercase tracking-wider", color)}>/ 100</span>
    </div>
  );
}
