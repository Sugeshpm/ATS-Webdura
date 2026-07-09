"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto/encrypt";
import { getPage, listForms, MetaGraphError } from "@/lib/meta/graph";

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
