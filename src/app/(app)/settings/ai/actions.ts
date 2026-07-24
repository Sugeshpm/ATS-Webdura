"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
  if (!me) redirect("/settings?error=no_profile");
  const role = (me as { role: string }).role;
  if (!["super_admin", "admin"].includes(role)) redirect("/settings?error=forbidden");
  return { supabase, tenantId: (me as { tenant_id: string }).tenant_id, userId: user.id };
}

const ALLOWED_MODELS = new Set([
  "claude-haiku-4-5-20251001",
  "claude-sonnet-5",
  "claude-opus-4-8"
]);

export async function saveAISettings(formData: FormData) {
  const { supabase, tenantId, userId } = await assertAdmin();

  const enabled = formData.get("enabled") === "on";
  const auto_run = formData.get("auto_run") === "on";
  const threshold = Math.max(0, Math.min(100, Number.parseInt(String(formData.get("score_threshold") ?? "70"), 10) || 70));
  const model = String(formData.get("model") ?? "claude-haiku-4-5-20251001");
  const cap = Math.max(0, Number.parseFloat(String(formData.get("monthly_cost_cap_usd") ?? "100")) || 100);

  if (!ALLOWED_MODELS.has(model)) {
    return redirect("/settings/ai?error=" + encodeURIComponent("Unknown model."));
  }

  await supabase
    .from("ai_settings")
    .upsert({
      tenant_id: tenantId,
      enabled, auto_run,
      score_threshold: threshold,
      model,
      monthly_cost_cap_usd: cap,
      updated_by: userId
    } as never);

  revalidatePath("/settings/ai");
  revalidatePath("/settings");
  redirect("/settings/ai?ok=1");
}

/** Manual "score all unscored" trigger — kicks off up to 100 pending apps. */
export async function scoreAllUnscored() {
  const { supabase, tenantId } = await assertAdmin();

  const { data: apps } = await supabase
    .from("applications")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("ai_status", null)
    .order("applied_at", { ascending: true })
    .limit(100);
  const ids = ((apps ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (!ids.length) return { ok: true as const, queued: 0 };

  // Fire-and-forget — the batch route will emit progress. Callers can watch
  // the settings-page live counters or open a candidate to see results.
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai/shortlist/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ application_ids: ids })
  }).catch(() => { /* ignored — best-effort */ });

  return { ok: true as const, queued: ids.length };
}
