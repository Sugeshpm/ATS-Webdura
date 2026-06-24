"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return redirect(`/login?error=${encodeURIComponent(signInError.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/login?error=${encodeURIComponent("Could not start session.")}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";

  // Block non-active accounts: sign out and surface the reason on the login page.
  if (status === "pending" || status === "rejected" || status === "disabled") {
    await supabase.auth.signOut();
    return redirect(`/login?status=${status}`);
  }

  // First successful sign-in by an invited member promotes them to active.
  if (status === "invited") {
    await supabase
      .from("profiles")
      .update({ status: "active", last_login_at: new Date().toISOString() } as never)
      .eq("id", user.id);
  } else {
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() } as never)
      .eq("id", user.id);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
