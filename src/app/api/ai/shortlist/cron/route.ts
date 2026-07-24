import { createServiceClient } from "@/lib/supabase/admin";
import { evaluateApplication } from "@/lib/ai/shortlist";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron endpoint — scans for un-evaluated applications in tenants that
 * have `ai_settings.auto_run = true` and processes up to N per invocation.
 *
 * Trigger with a Vercel Cron (declared in vercel.json). The secret is checked
 * via the `Authorization: Bearer <CRON_SECRET>` header that Vercel sends when
 * `CRON_SECRET` is set in project env vars.
 */

const CRON_BUDGET = 50;   // max apps processed per cron tick

export async function GET(req: Request) {
  // Auth: Vercel Cron sends this header when CRON_SECRET is set.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const provided = req.headers.get("authorization") ?? "";
    if (provided !== `Bearer ${expected}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createServiceClient();

  // Which tenants have auto_run on AND aren't over their spend cap?
  const { data: tenants } = await admin
    .from("ai_settings")
    .select("tenant_id, monthly_cost_cap_usd, current_month_spend_usd")
    .eq("enabled", true)
    .eq("auto_run", true);
  const eligibleTenants = ((tenants ?? []) as Array<{ tenant_id: string; monthly_cost_cap_usd: number; current_month_spend_usd: number }>)
    .filter((t) => Number(t.current_month_spend_usd) < Number(t.monthly_cost_cap_usd))
    .map((t) => t.tenant_id);

  if (!eligibleTenants.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0, reason: "no eligible tenants" }), {
      headers: { "content-type": "application/json" }
    });
  }

  // Find un-evaluated applications for those tenants (oldest first — fair queue).
  const { data: pending } = await admin
    .from("applications")
    .select("id, tenant_id")
    .in("tenant_id", eligibleTenants)
    .is("ai_status", null)
    .order("applied_at", { ascending: true })
    .limit(CRON_BUDGET);

  const ids = ((pending ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0, reason: "queue empty" }), {
      headers: { "content-type": "application/json" }
    });
  }

  // Process with mild concurrency — running as the service role, not a user.
  const CONCURRENCY = 3;
  let ok = 0, err = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const wave = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      wave.map((id) => evaluateApplication(id, {}, null).catch(() => ({ status: "error" as const })))
    );
    for (const r of results) {
      if (r.status === "ok" || r.status === "cached") ok++;
      else err++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: ok, errors: err }), {
    headers: { "content-type": "application/json" }
  });
}
