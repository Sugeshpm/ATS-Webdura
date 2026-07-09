"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { getForm, listForms, listPages, subscribePageToLeadgen, MetaGraphError } from "@/lib/meta/graph";
import { clearMetaOAuthSession, readMetaOAuthSession } from "@/lib/meta/oauth";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
  if (!me || !["super_admin", "admin"].includes((me as { role: string }).role)) {
    return { ok: false as const, error: "Admin only." };
  }
  return { ok: true as const, supabase, tenant_id: (me as { tenant_id: string }).tenant_id, user_id: user.id };
}

export async function updateMetaFormJob(formData: FormData) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return;
  const id = String(formData.get("id") ?? "");
  const job_id = String(formData.get("job_id") ?? "").trim() || null;
  if (!id) return;

  await ctx.supabase.from("meta_lead_forms").update({ job_id } as never).eq("id", id);
  revalidatePath("/settings/integrations/meta/forms");
}

export async function toggleMetaFormActive(formData: FormData) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return;
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  if (!id) return;

  await ctx.supabase.from("meta_lead_forms").update({ is_active: !active } as never).eq("id", id);
  revalidatePath("/settings/integrations/meta/forms");
}

export async function deleteMetaForm(formData: FormData) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await ctx.supabase.from("meta_lead_forms").delete().eq("id", id);
  revalidatePath("/settings/integrations/meta/forms");
}

// ---------------------------------------------------------------------------
// Facebook Login (OAuth) connect flow
// ---------------------------------------------------------------------------

/** Resolve the current OAuth user token to the caller's chosen Page + its token. */
async function pageFromSession(pageId: string) {
  const session = await readMetaOAuthSession();
  if (!session) return { ok: false as const, error: "Facebook session expired — please reconnect." };
  const pages = await listPages(session.token);
  const page = pages.find((p) => p.id === pageId);
  if (!page) return { ok: false as const, error: "Page not found or you no longer manage it." };
  return { ok: true as const, page };
}

/**
 * List Lead Ad forms for a Page the admin selected in the connect wizard.
 * Uses the encrypted OAuth session cookie — no token crosses the wire.
 */
export async function metaOAuthListForms(pageId: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };

  try {
    const resolved = await pageFromSession(pageId);
    if (!resolved.ok) return resolved;
    const forms = await listForms(resolved.page.access_token, pageId);
    return {
      ok: true as const,
      page_name: resolved.page.name,
      forms: forms.map((f) => ({ id: f.id, name: f.name, status: f.status ?? null }))
    };
  } catch (e) {
    return { ok: false as const, error: e instanceof MetaGraphError ? e.message : (e as Error).message };
  }
}

/**
 * Register a form picked in the connect wizard. Pulls the Page access token from
 * the OAuth session (via `/me/accounts`), encrypts it, and upserts the form row.
 */
export async function registerFormViaOAuth(input: {
  page_id: string;
  page_name?: string | null;
  form_id: string;
  form_name?: string | null;
  job_id?: string | null;
}) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };

  if (!input.page_id || !input.form_id) {
    return { ok: false as const, error: "Missing page or form." };
  }

  try {
    const resolved = await pageFromSession(input.page_id);
    if (!resolved.ok) return resolved;

    const admin = createServiceClient();
    const { error } = await admin.from("meta_lead_forms").upsert(
      {
        tenant_id: ctx.tenant_id,
        page_id: input.page_id,
        page_name: input.page_name || resolved.page.name || null,
        form_id: input.form_id,
        form_name: input.form_name || null,
        job_id: input.job_id || null,
        field_mapping: {},
        is_active: true,
        page_access_token_encrypted: encrypt(resolved.page.access_token)
      } as never,
      { onConflict: "tenant_id,form_id" }
    );
    if (error) return { ok: false as const, error: `Save failed: ${error.message}` };

    revalidatePath("/settings/integrations/meta/forms");
    revalidatePath("/settings/integrations/meta");

    // Subscribe the Page to our webhook so leads arrive in real time (not just on
    // manual sync). Non-fatal — the form is saved either way.
    try {
      await subscribePageToLeadgen(resolved.page.access_token, input.page_id);
    } catch (e) {
      const msg = e instanceof MetaGraphError ? e.message : (e as Error).message;
      return { ok: true as const, warning: `Saved, but real-time delivery couldn't be enabled: ${msg}. Leads still arrive via Sync now.` };
    }
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof MetaGraphError ? e.message : (e as Error).message };
  }
}

/**
 * (Re)subscribe a Page to our webhook for real-time leads. Uses the current OAuth
 * session's Page token, so it works for Pages connected before we added the
 * subscription step. Requires re-login if the session lacks pages_manage_metadata.
 */
export async function enablePageRealtime(pageId: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };
  try {
    const resolved = await pageFromSession(pageId);
    if (!resolved.ok) return resolved;
    await subscribePageToLeadgen(resolved.page.access_token, pageId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof MetaGraphError ? e.message : (e as Error).message };
  }
}

/** End the connect session (drops the encrypted user-token cookie). */
export async function endMetaOAuthSession() {
  await clearMetaOAuthSession();
}

// ---------------------------------------------------------------------------
// Field mapping — map Meta form questions onto candidate profile fields
// ---------------------------------------------------------------------------

// Kept internal — "use server" modules may only export async functions.
interface FormField {
  name: string;      // Meta field key (matches field_data[].name)
  label?: string;    // human label from the form question, if known
  sample?: string;   // a recent value, to help the admin recognise the field
}

/**
 * Build the field catalog + current mapping for a registered form.
 * Fields come from the last few received leads (what actually arrives);
 * if none yet, falls back to the form's questions via the Graph API.
 */
export async function getFieldMapping(formId: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };

  const admin = createServiceClient();
  const { data: form } = await admin
    .from("meta_lead_forms")
    .select("form_id, field_mapping, page_access_token_encrypted")
    .eq("tenant_id", ctx.tenant_id)
    .eq("form_id", formId)
    .maybeSingle();
  if (!form) return { ok: false as const, error: "Form not registered." };
  const row = form as { field_mapping: Record<string, string> | null; page_access_token_encrypted: string | null };

  // 1. Field names seen in recent leads.
  const { data: raws } = await admin
    .from("meta_leads_raw")
    .select("raw_payload")
    .eq("tenant_id", ctx.tenant_id)
    .eq("form_id", formId)
    .order("received_at", { ascending: false })
    .limit(25);

  const byName = new Map<string, FormField>();
  for (const r of (raws ?? []) as { raw_payload: { field_data?: { name?: string; values?: string[] }[] } | null }[]) {
    const fd = r.raw_payload?.field_data;
    if (!Array.isArray(fd)) continue;
    for (const f of fd) {
      if (!f?.name || byName.has(f.name)) continue;
      const sample = (f.values ?? []).find((v) => v && v.trim())?.trim();
      byName.set(f.name, { name: f.name, sample });
    }
  }

  // 2. Fallback: pull questions from Meta if we've seen no leads yet.
  if (byName.size === 0 && row.page_access_token_encrypted) {
    try {
      const token = decrypt(row.page_access_token_encrypted);
      const meta = await getForm(token, formId);
      for (const q of meta.questions ?? []) {
        if (q.key && !byName.has(q.key)) byName.set(q.key, { name: q.key, label: q.label });
      }
    } catch {
      // Non-fatal — admin can still map once leads arrive.
    }
  }

  return {
    ok: true as const,
    fields: Array.from(byName.values()),
    mapping: row.field_mapping ?? {}
  };
}

/** Persist a form's field mapping ({ meta_field_name: candidate_target }). */
export async function saveFieldMapping(formId: string, mapping: Record<string, string>) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };

  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) {
    if (k && typeof v === "string" && v) clean[k] = v;
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from("meta_lead_forms")
    .update({ field_mapping: clean } as never)
    .eq("tenant_id", ctx.tenant_id)
    .eq("form_id", formId);
  if (error) return { ok: false as const, error: `Save failed: ${error.message}` };

  revalidatePath("/settings/integrations/meta/forms");
  return { ok: true as const };
}
