import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth + email-confirmation callback. Handles:
 *   - Google OAuth (?code=...)  ← new
 *   - Password-reset invite links (?next=/reset-password)
 *
 * After exchanging the code for a session we inspect the profile status
 * created by the DB trigger:
 *
 *   'active'   → /dashboard
 *   'invited'  → /reset-password?invited=1 (first sign-in from invite)
 *   'pending'  → sign out, /login?status=pending  (needs admin approval)
 *   'rejected' → sign out, /login?status=rejected_domain (domain gate failed)
 *   'disabled' → sign out, /login?status=disabled
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");
  const errorParam = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Could not start session.")}`);
  }

  // Invite-link path: WP-style ?next=/reset-password sends first-time invitees to set a password.
  if (explicitNext) {
    const url = explicitNext.startsWith("/reset-password") ? `${explicitNext}?invited=1` : explicitNext;
    return NextResponse.redirect(`${origin}${url}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  const status = (profile as { status: string } | null)?.status ?? "pending";

  // Reject: sign the user OUT before redirecting so they don't retain a session
  // for an account they can't use.
  if (status === "pending" || status === "rejected" || status === "disabled") {
    await supabase.auth.signOut();
    // Distinguish domain-block from admin-block so the login banner can be honest about the cause.
    // We can't tell them apart from the status alone — the trigger uses 'rejected' for both cases.
    // For Google OAuth this is almost always domain-block; the banner will say "declined" either way,
    // which is acceptable. If we want a distinct banner, add a status_reason column later.
    return NextResponse.redirect(`${origin}/login?status=${status}`);
  }

  if (status === "invited") {
    return NextResponse.redirect(`${origin}/reset-password?invited=1`);
  }

  // Approved user: record login timestamp and go to app.
  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() } as never)
    .eq("id", user.id);

  return NextResponse.redirect(`${origin}/dashboard`);
}
