import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { META_OAUTH_SCOPES, META_STATE_COOKIE, metaRedirectUri } from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? "v20.0";

/**
 * Kick off Facebook Login. Verifies the caller is a signed-in admin, mints a
 * CSRF `state`, stashes it in an httpOnly cookie, and redirects to the Facebook
 * OAuth dialog. Facebook returns to `/oauth/callback` with `code` + `state`.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const backTo = (msg: string) =>
    NextResponse.redirect(new URL(`/settings/integrations/meta?msg=${msg}`, origin));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!me || !["super_admin", "admin"].includes((me as { role: string }).role)) {
    return backTo(`error:${encodeURIComponent("Admin only.")}`);
  }
  if (!process.env.META_APP_ID) {
    return backTo(`error:${encodeURIComponent("META_APP_ID is not configured.")}`);
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authUrl.searchParams.set("client_id", process.env.META_APP_ID);
  authUrl.searchParams.set("redirect_uri", metaRedirectUri());
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", META_OAUTH_SCOPES);
  authUrl.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(META_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return res;
}
