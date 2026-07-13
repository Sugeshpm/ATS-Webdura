"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role: string } | null)?.role !== "super_admin") {
    redirect("/settings?error=forbidden");
  }
  return supabase;
}

export async function addAllowedDomain(formData: FormData) {
  const supabase = await assertSuperAdmin();
  const raw = String(formData.get("domain") ?? "").trim().toLowerCase().replace(/^@/, "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!ALLOWED_DOMAIN_PATTERN.test(raw)) {
    return redirect(`/settings/access?error=${encodeURIComponent("Enter a valid domain, e.g. example.com")}`);
  }
  const { error } = await supabase.from("auth_allowed_domains").insert({ domain: raw, reason } as never);
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return redirect(`/settings/access?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/settings/access");
  redirect("/settings/access?ok=domain_added");
}

export async function removeAllowedDomain(domain: string) {
  const supabase = await assertSuperAdmin();
  await supabase.from("auth_allowed_domains").delete().eq("domain", domain);
  revalidatePath("/settings/access");
}

export async function addEmailToWhitelist(formData: FormData) {
  const supabase = await assertSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!EMAIL_PATTERN.test(email)) {
    return redirect(`/settings/access?error=${encodeURIComponent("Enter a valid email address.")}`);
  }
  const { error } = await supabase.from("auth_email_whitelist").insert({ email, reason } as never);
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    return redirect(`/settings/access?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/settings/access");
  redirect("/settings/access?ok=email_added");
}

export async function removeEmailFromWhitelist(email: string) {
  const supabase = await assertSuperAdmin();
  await supabase.from("auth_email_whitelist").delete().eq("email", email);
  revalidatePath("/settings/access");
}
