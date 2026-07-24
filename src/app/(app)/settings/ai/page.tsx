import { redirect } from "next/navigation";
import { Sparkles, DollarSign, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BackToSettings } from "@/components/settings/back-link";
import { saveAISettings } from "./actions";

export const dynamic = "force-dynamic";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast & cheap (recommended)" },
  { id: "claude-sonnet-5",           label: "Claude Sonnet 5 — balanced" },
  { id: "claude-opus-4-8",           label: "Claude Opus 4.8 — max quality" }
];

export default async function AISettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
  const role = (me as { role?: string } | null)?.role;
  const tenantId = (me as { tenant_id?: string } | null)?.tenant_id;
  if (!tenantId) redirect("/settings?error=no_profile");
  if (!["super_admin", "admin"].includes(role ?? "")) redirect("/settings?error=forbidden");

  // Load-or-seed settings row.
  let { data: settings } = await supabase.from("ai_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!settings) {
    const { data: inserted } = await supabase.from("ai_settings").insert({ tenant_id: tenantId } as never).select("*").single();
    settings = inserted;
  }
  const s = settings as {
    enabled: boolean;
    auto_run: boolean;
    score_threshold: number;
    model: string;
    monthly_cost_cap_usd: number;
    current_month_spend_usd: number;
  };

  const spend = Number(s.current_month_spend_usd) || 0;
  const cap = Number(s.monthly_cost_cap_usd) || 0;
  const percent = cap > 0 ? Math.min(100, Math.round((spend / cap) * 100)) : 0;
  const nearCap = percent >= 80;

  // Stats
  const [{ count: evalCount }, { data: verdictRows }] = await Promise.all([
    supabase.from("ai_evaluations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", monthStart()),
    supabase.from("applications").select("ai_status").eq("tenant_id", tenantId).not("ai_status", "is", null).limit(10000)
  ]);
  const counts = tallyVerdicts((verdictRows as Array<{ ai_status: string }> | null) ?? []);

  return (
    <div className="container max-w-3xl py-8">
      <BackToSettings />
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">AI shortlisting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Claude to score resumes against job descriptions. Recruiters see an <em>AI Shortlisted</em> badge for candidates above the threshold.
          </p>
        </div>
      </div>

      {sp.ok && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          Settings saved.
        </div>
      )}
      {sp.error && (
        <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">
          {decodeURIComponent(sp.error)}
        </div>
      )}

      {/* ============ Configuration ============ */}
      <Card className="mt-6">
        <form action={saveAISettings}>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Requires <code>ANTHROPIC_API_KEY</code> on the server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between rounded-md border border-input p-3">
              <div>
                <div className="text-sm font-medium">Enable AI shortlisting</div>
                <p className="text-xs text-muted-foreground">Turn this off to pause all AI features tenant-wide.</p>
              </div>
              <Switch name="enabled" defaultChecked={s.enabled} />
            </label>

            <label className="flex items-center justify-between rounded-md border border-input p-3">
              <div>
                <div className="text-sm font-medium">Auto-score new applications</div>
                <p className="text-xs text-muted-foreground">
                  Any new candidate application (CSV import, WordPress form, Meta Lead Ads, manual add) is scored within ~1 minute.
                </p>
              </div>
              <Switch name="auto_run" defaultChecked={s.auto_run} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="score_threshold">Score threshold</Label>
                <Input
                  id="score_threshold"
                  name="score_threshold"
                  type="number"
                  min={0} max={100}
                  defaultValue={s.score_threshold}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Candidates ≥ this score are marked <em>AI Shortlisted</em>.</p>
              </div>
              <div>
                <Label htmlFor="monthly_cost_cap_usd">Monthly cost cap (USD)</Label>
                <Input
                  id="monthly_cost_cap_usd"
                  name="monthly_cost_cap_usd"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={s.monthly_cost_cap_usd}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Auto-scoring pauses when this cap is reached.</p>
              </div>
            </div>

            <div>
              <Label>Model</Label>
              <select name="model" defaultValue={s.model} className="mt-1 h-9 w-full rounded-md border border-input bg-white px-3 text-sm">
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Save settings</Button>
          </CardFooter>
        </form>
      </Card>

      {/* ============ Spend + stats ============ */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> This month
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-semibold tabular-nums">${spend.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              of ${cap.toFixed(2)} cap · {evalCount ?? 0} evaluations
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full ${nearCap ? "bg-rose-500" : "bg-primary"}`} style={{ width: `${percent}%` }} />
            </div>
            {nearCap && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-rose-600">
                <ShieldAlert className="h-3 w-3" /> Nearing the monthly cap.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Verdict breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pb-4">
            <StatRow label="Shortlisted"     n={counts.shortlisted}     tone="emerald" />
            <StatRow label="Borderline"      n={counts.borderline}      tone="amber" />
            <StatRow label="Not shortlisted" n={counts.not_shortlisted} tone="rose" />
            <StatRow label="No resume"       n={counts.no_resume}       tone="slate" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function tallyVerdicts(rows: { ai_status: string | null }[]) {
  const c = { shortlisted: 0, borderline: 0, not_shortlisted: 0, no_resume: 0 };
  for (const r of rows) {
    if (r.ai_status && r.ai_status in c) c[r.ai_status as keyof typeof c]++;
  }
  return c;
}

function StatRow({ label, n, tone }: { label: string; n: number; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const cls = {
    emerald: "text-emerald-700",
    amber:   "text-amber-700",
    rose:    "text-rose-700",
    slate:   "text-muted-foreground"
  }[tone];
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cls}>{label}</span>
      <span className="tabular-nums font-semibold">{n}</span>
    </div>
  );
}
