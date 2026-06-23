"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name  = String(formData.get("last_name") ?? "").trim();
  const tenant_name = String(formData.get("organisation") ?? "").trim();

  if (!email || !password || !tenant_name) {
    return redirect(`/signup?error=${encodeURIComponent("Organisation, email and password are required.")}`);
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
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
