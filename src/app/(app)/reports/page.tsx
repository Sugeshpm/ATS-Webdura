import { BarChart3, TrendingDown, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface RejectionByStage {
  stage_id: string;
  stage_name: string;
  stage_order: number;
  rejected_count: number;
}
interface TopReason {
  reason_code: string;
  reason_count: number;
}

const REASON_LABELS: Record<string, string> = {
  skills_gap:       "Skills gap",
  experience_gap:   "Experience mismatch",
  compensation:     "Compensation mismatch",
  culture_fit:      "Culture fit",
  location:         "Location constraint",
  notice_period:    "Notice period too long",
  communication:    "Communication skills",
  failed_technical: "Failed technical round",
  failed_hr:        "Failed HR round",
  withdrew:         "Candidate withdrew",
  position_closed:  "Position closed / on hold",
  other:            "Other"
};

export default async function ReportsPage() {
  const supabase = await createClient();

  // Any table that might not exist yet in the target Supabase (until the
  // migration is applied) is wrapped so its rejection can't crash the page.
  const safe = async <T,>(p: PromiseLike<{ data: T | null; count?: number | null }>) => {
    try { return await p; } catch { return { data: null as T | null, count: 0 }; }
  };

  const [funnelRes, reasonsRes, totalRejectedRes] = await Promise.all([
    safe<RejectionByStage[]>(supabase.rpc("rejection_funnel", { p_job_id: null })),
    safe<TopReason[]>(supabase.rpc("top_rejection_reasons", { p_job_id: null, p_limit: 20 })),
    safe<null>(supabase.from("applications").select("id", { count: "exact", head: true }).not("rejected_from_stage_id", "is", null))
  ]);

  const funnel = (funnelRes.data as RejectionByStage[] | null) ?? [];
  const reasons = (reasonsRes.data as TopReason[] | null) ?? [];
  const totalRejected = totalRejectedRes.count ?? 0;
  const maxFunnel = Math.max(1, ...funnel.map((f) => Number(f.rejected_count)));
  const maxReason = Math.max(1, ...reasons.map((r) => Number(r.reason_count)));

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where do candidates fall off the pipeline, and why?
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Total rejected (tracked)"
          value={totalRejected.toLocaleString()}
          hint="Candidates with a captured rejection stage"
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Most common stage"
          value={funnel[0]?.stage_name ?? "—"}
          hint={funnel[0] ? `${Number(funnel[0].rejected_count).toLocaleString()} rejected here` : "No data yet"}
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label="Most common reason"
          value={reasons[0] ? (REASON_LABELS[reasons[0].reason_code] ?? reasons[0].reason_code) : "—"}
          hint={reasons[0] ? `${Number(reasons[0].reason_count).toLocaleString()} candidates` : "No data yet"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Rejections by stage</CardTitle>
          <CardDescription>How many candidates were rejected while in each stage.</CardDescription>
        </CardHeader>
        <CardContent>
          {funnel.length === 0 ? (
            <EmptyChart label="No rejection data yet. This chart populates as recruiters reject candidates from specific stages." />
          ) : (
            <ul className="space-y-2">
              {funnel.map((row) => {
                const n = Number(row.rejected_count);
                const percent = Math.round((n / maxFunnel) * 100);
                return (
                  <li key={row.stage_id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{row.stage_name}</span>
                      <span className="tabular-nums text-muted-foreground">{n.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full ${n > 0 ? "bg-rose-500/70" : "bg-transparent"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Top rejection reasons</CardTitle>
          <CardDescription>Ranked by how often each reason was captured when rejecting candidates.</CardDescription>
        </CardHeader>
        <CardContent>
          {reasons.length === 0 ? (
            <EmptyChart label="No reasons captured yet. Recruiters are asked to pick a reason when they move a candidate into Rejected." />
          ) : (
            <ul className="space-y-2">
              {reasons.map((row) => {
                const n = Number(row.reason_count);
                const percent = Math.round((n / maxReason) * 100);
                return (
                  <li key={row.reason_code}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{REASON_LABELS[row.reason_code] ?? row.reason_code}</span>
                      <span className="tabular-nums text-muted-foreground">{n.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary/70" style={{ width: `${percent}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Tip: click a rejected candidate&apos;s stage badge to review the captured reason and notes. Job-specific reports live on each job&apos;s Dashboard tab.
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
