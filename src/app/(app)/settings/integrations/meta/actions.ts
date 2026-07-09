"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { getForm, getPage, listForms, listPages, MetaGraphError } from "@/lib/meta/graph";
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

function flash(status: "success" | "error", message: string, redirectTo = "/settings/integrations/meta") {
  redirect(`${redirectTo}?msg=${status}:${encodeURIComponent(message)}`);
}

/**
 * Verify a Page Access Token by asking Graph API to identify the Page it belongs to.
 * Persists nothing — this is the "test connection" button.
 */
export async function verifyMetaToken(formData: FormData) {
  const ctx = await requireAdmin();
  if (!ctx.ok) flash("error", ctx.error);

  const pageId = String(formData.get("page_id") ?? "").trim();
  const token  = String(formData.get("token") ?? "").trim();
  if (!pageId || !token) flash("error", "Both Page ID and Access Token are required.");

  try {
    const page = await getPage(token, pageId);
    flash("success", `Verified page "${page.name}" (${page.id}). Ready to register forms.`, `/settings/integrations/meta/forms?page_id=${page.id}&token_verified=1`);
  } catch (e) {
    const msg = e instanceof MetaGraphError ? `Graph API: ${e.message}` : (e as Error).message;
    flash("error", msg);
  }
}

/**
 * Register a Lead Ad form for auto-ingest. Stores the encrypted Page Access Token.
 */
export async function registerMetaForm(formData: FormData) {
  const ctx = await requireAdmin();
  if (!ctx.ok) flash("error", ctx.error, "/settings/integrations/meta/forms");

  const page_id = String(formData.get("page_id") ?? "").trim();
  const form_id = String(formData.get("form_id") ?? "").trim();
  const form_name = String(formData.get("form_name") ?? "").trim();
  const page_name = String(formData.get("page_name") ?? "").trim();
  const job_id = String(formData.get("job_id") ?? "").trim() || null;
  const token = String(formData.get("token") ?? "").trim();

  if (!page_id || !form_id || !token) flash("error", "Missing page, form, or token.", "/settings/integrations/meta/forms");
  if (!ctx.ok) return;

  const admin = createServiceClient();
  const encryptedToken = encrypt(token);

  const { error } = await admin.from("meta_lead_forms").upsert(
    {
      tenant_id: ctx.tenant_id,
      page_id,
      page_name: page_name || null,
      form_id,
      form_name: form_name || null,
      job_id,
      field_mapping: {},
      is_active: true,
      page_access_token_encrypted: encryptedToken
    } as never,
    { onConflict: "tenant_id,form_id" }
  );

  if (error) flash("error", `Save failed: ${error.message}`, "/settings/integrations/meta/forms");
  revalidatePath("/settings/integrations/meta/forms");
  flash("success", `Registered form "${form_name || form_id}".`, "/settings/integrations/meta/forms");
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

/**
 * Fetch available forms from a Page (Graph API). Used by the "Add form" dialog.
 * Called from a server component so the token never touches the browser.
 */
export async function fetchMetaForms(pageId: string, token: string) {
  try {
    const [page, forms] = await Promise.all([getPage(token, pageId), listForms(token, pageId)]);
    return { ok: true as const, page, forms };
  } catch (e) {
    return { ok: false as const, error: e instanceof MetaGraphError ? e.message : (e as Error).message };
  }
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
