"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

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
  if (!ctx.ok) return ctx;
  const admin = createServiceClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(targetEmail, {
    data: { invited_by_admin: true, tenant_id: ctx.me.tenant_id },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function inviteUser(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const role = String(formData.get("role") ?? "recruiter");
  if (!email) return;

  const ctx = await requireAdmin();
  if (!ctx.ok) return;

  const admin = createServiceClient();
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name, last_name, tenant_id: ctx.me.tenant_id, role, invited_by_admin: true },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`
  });
  if (error || !invited?.user) return;

  // The trigger created a profile with role='recruiter' status='invited'; sync explicit values.
  await admin
    .from("profiles")
    .update({ tenant_id: ctx.me.tenant_id, role, status: "invited", first_name, last_name } as never)
    .eq("id", invited.user.id);

  revalidatePath("/settings/users");
}
