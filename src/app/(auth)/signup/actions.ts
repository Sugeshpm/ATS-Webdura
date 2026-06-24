"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name  = String(formData.get("last_name") ?? "").trim();
  // Org name only matters for the very first user; the trigger uses a default otherwise.
  const tenant_name = String(formData.get("organisation") ?? "").trim() || "My Organisation";

  if (!email || !password) {
    return redirect(`/signup?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name, last_name, tenant_name },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`
    }
  });

  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // After signUp the user is auto-signed-in. If they're not active (i.e. they're
  // a regular new signup awaiting approval), sign them out and tell them so.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).single();
    if (profile?.status !== "active") {
      await supabase.auth.signOut();
      return redirect(`/login?signup=pending`);
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
