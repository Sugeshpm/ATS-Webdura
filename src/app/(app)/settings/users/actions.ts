"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

function flashRedirect(status: "success" | "error", message: string) {
  redirect(`/settings/users?invite=${status}&msg=${encodeURIComponent(message)}`);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("tenant_id, role").eq("id", user.id).single();
  if (!me || !["super_admin", "admin"].includes(me.role)) return { ok: false as const, error: "Admin only." };
  return { ok: true as const, supabase, me, userId: user.id };
}

export async function approveUser(targetId: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ status: "active" } as never)
    .eq("id", targetId)
    .eq("tenant_id", ctx.me.tenant_id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function rejectUser(targetId: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;
  if (targetId === ctx.userId) return { ok: false as const, error: "You can't reject yourself." };
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ status: "rejected" } as never)
    .eq("id", targetId)
    .eq("tenant_id", ctx.me.tenant_id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function setUserStatus(targetId: string, status: "active" | "disabled" | "rejected" | "pending") {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;
  if (targetId === ctx.userId && status !== "active") return { ok: false as const, error: "You can't change your own status." };
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ status } as never)
    .eq("id", targetId)
    .eq("tenant_id", ctx.me.tenant_id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function changeRole(targetId: string, role: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) return ctx;
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ role } as never)
    .eq("id", targetId)
    .eq("tenant_id", ctx.me.tenant_id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function resendInvite(targetEmail: string) {
  const ctx = await requireAdmin();
  if (!ctx.ok) flashRedirect("error", ctx.error);

  let admin;
  try { admin = createServiceClient(); }
  catch (e) { flashRedirect("error", e instanceof Error ? e.message : "Service role key not configured."); return; }

  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`;
  const { error } = await admin.auth.admin.inviteUserByEmail(targetEmail, {
    data: { invited_by_admin: true, tenant_id: ctx.ok ? ctx.me.tenant_id : null },
    redirectTo: callbackUrl
  });
  if (error) flashRedirect("error", error.message);
  revalidatePath("/settings/users");
  flashRedirect("success", `Invitation re-sent to ${targetEmail}.`);
}

export async function inviteUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const role = String(formData.get("role") ?? "recruiter");
  if (!email) flashRedirect("error", "Email is required.");

  const ctx = await requireAdmin();
  if (!ctx.ok) flashRedirect("error", ctx.error);
  if (!ctx.ok) return; // narrowing helper

  // Pre-check duplicate to give a friendlier error than Supabase's raw 422.
  const { data: existing } = await ctx.supabase.from("profiles").select("id, status").eq("email", email).maybeSingle();
  if (existing) flashRedirect("error", `A user with ${email} already exists (status: ${(existing as { status: string }).status}).`);

  let admin;
  try { admin = createServiceClient(); }
  catch (e) { flashRedirect("error", e instanceof Error ? e.message : "Service role key not configured. Set SUPABASE_SERVICE_ROLE_KEY."); return; }

  const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`;
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name, last_name, tenant_id: ctx.me.tenant_id, role, invited_by_admin: true },
    redirectTo: callbackUrl
  });
  if (error || !invited?.user) flashRedirect("error", error?.message ?? "Invitation failed — Supabase returned no user.");
  if (!invited?.user) return;

  // The DB trigger created the profile; ensure explicit role + names are set.
  const { error: updErr } = await admin
    .from("profiles")
    .update({ tenant_id: ctx.me.tenant_id, role, status: "invited", first_name, last_name } as never)
    .eq("id", invited.user.id);
  if (updErr) flashRedirect("error", `Invite sent, but couldn't sync profile: ${updErr.message}`);

  revalidatePath("/settings/users");
  flashRedirect("success", `Invitation sent to ${email}. They'll receive an email shortly.`);
}
