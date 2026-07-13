"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Start the Google OAuth flow. Server action — Supabase generates the
 * provider URL (with PKCE) and we redirect the browser to it. Google will
 * bounce back to /auth/callback?code=... which our callback route already
 * handles.
 */
export async function signInWithGoogleAction() {
  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? h.get("x-forwarded-host") ?? "";
  const base = origin.startsWith("http") ? origin : `https://${origin}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback`,
      // Ask Google for the profile scopes we need to populate first/last name.
      scopes: "openid email profile",
      queryParams: { access_type: "offline", prompt: "select_account" }
    }
  });

  if (error || !data?.url) {
    return redirect(`/login?error=${encodeURIComponent(error?.message ?? "Could not start Google sign-in.")}`);
  }
  redirect(data.url);
}
