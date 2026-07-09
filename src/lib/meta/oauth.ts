import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";

/**
 * Facebook Login (OAuth) helpers for the Meta Lead Ads connect flow.
 *
 * The short-lived `code` from Facebook's redirect is exchanged for a long-lived
 * *user* token, which we keep only long enough for the admin to pick a Page + form.
 * It lives in an httpOnly, AES-GCM-encrypted cookie — never in the browser JS
 * context and never persisted to the database. Only the per-Page access tokens
 * (fetched via `/me/accounts`) are stored, encrypted, on the registered form row.
 */

// Permissions the connect flow needs. `leads_retrieval` requires Meta App Review.
// `pages_manage_metadata` is required to subscribe a Page to our webhook (real-time leads).
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "pages_manage_metadata",
  "leads_retrieval",
  "business_management"
].join(",");

export const META_SESSION_COOKIE = "meta_oauth";
export const META_STATE_COOKIE = "meta_oauth_state";

/** Seconds the encrypted user-token cookie survives (enough to finish setup). */
export const META_SESSION_MAX_AGE = 60 * 60 * 2;

/**
 * Redirect URI registered in the Meta app's "Valid OAuth Redirect URIs".
 * Uses the stable site URL so it matches the whitelist across preview/prod.
 */
export function metaRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/integrations/meta/oauth/callback`;
}

export interface MetaOAuthSession {
  token: string;
  expiresAt: string | null;
}

/** Encrypt the user token (+ expiry) for storage in the session cookie. */
export function encodeMetaSession(token: string, expiresAt: string | null): string {
  return encrypt(JSON.stringify({ t: token, e: expiresAt }));
}

/** Read + decrypt the current OAuth session cookie. Returns null if absent/invalid. */
export async function readMetaOAuthSession(): Promise<MetaOAuthSession | null> {
  const store = await cookies();
  const raw = store.get(META_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decrypt(raw)) as { t?: string; e?: string | null };
    if (!parsed?.t) return null;
    return { token: parsed.t, expiresAt: parsed.e ?? null };
  } catch {
    return null;
  }
}

/** Drop the session cookie (call after the admin has finished connecting). */
export async function clearMetaOAuthSession(): Promise<void> {
  const store = await cookies();
  store.delete(META_SESSION_COOKIE);
}
