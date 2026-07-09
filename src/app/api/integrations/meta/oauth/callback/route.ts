import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { exchangeCodeForToken, exchangeForLongLived, MetaGraphError } from "@/lib/meta/graph";
import {
  META_SESSION_COOKIE,
  META_SESSION_MAX_AGE,
  META_STATE_COOKIE,
  encodeMetaSession,
  metaRedirectUri
} from "@/lib/meta/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Facebook Login redirect target. Verifies CSRF `state`, swaps the `code` for a
 * long-lived user token, encrypts it into the session cookie, and forwards the
 * admin to the Page/form picker.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error_description") ?? params.get("error");

  const backTo = (msg: string) =>
    NextResponse.redirect(new URL(`/settings/integrations/meta?msg=${msg}`, origin));

  if (oauthError) {
    return backTo(`error:${encodeURIComponent(`Facebook login cancelled: ${oauthError}`)}`);
  }

  const stateCookie = req.cookies.get(META_STATE_COOKIE)?.value;
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return backTo(`error:${encodeURIComponent("OAuth state mismatch — please retry the connection.")}`);
  }

  try {
    const short = await exchangeCodeForToken(code, metaRedirectUri());
    const long = await exchangeForLongLived(short.access_token);
    const expiresAt = long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null;

    const res = NextResponse.redirect(new URL("/settings/integrations/meta/connect", origin));
    res.cookies.set(META_SESSION_COOKIE, encodeMetaSession(long.access_token, expiresAt), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: META_SESSION_MAX_AGE
    });
    res.cookies.delete(META_STATE_COOKIE);
    return res;
  } catch (e) {
    const msg = e instanceof MetaGraphError ? e.message : (e as Error).message;
    return backTo(`error:${encodeURIComponent(msg)}`);
  }
}
