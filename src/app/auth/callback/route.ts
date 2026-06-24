import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Routing rules:
  //   - explicit ?next= from invitation links → honour it (route invited users to /reset-password?invited=1)
  //   - newly-invited users (status='invited') → /reset-password?invited=1 so they can set a password
  //   - everyone else → /dashboard
  const { data: { user } } = await supabase.auth.getUser();

  if (explicitNext) {
    const url = explicitNext.startsWith("/reset-password") ? `${explicitNext}?invited=1` : explicitNext;
    return NextResponse.redirect(`${origin}${url}`);
  }

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).single();
    if (profile?.status === "invited") {
      return NextResponse.redirect(`${origin}/reset-password?invited=1`);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
