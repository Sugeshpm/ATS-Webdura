import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto/encrypt";

export interface IntakeCredential {
  id: string;
  tenant_id: string;
  api_key: string;
  api_secret: string;             // decrypted
  default_job_id: string | null;
  allowed_origins: string[];
  is_active: boolean;
  revoked_at: string | null;
}

/** Look up and decrypt an active credential by its api_key. */
export async function loadCredential(apiKey: string): Promise<IntakeCredential | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("public_intake_credentials")
    .select("id, tenant_id, api_key, api_secret_encrypted, default_job_id, allowed_origins, is_active, revoked_at")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as IntakeCredential & { api_secret_encrypted: string };
  let secret: string;
  try { secret = decrypt(row.api_secret_encrypted); }
  catch { return null; }
  return { ...row, api_secret: secret };
}

/**
 * Verify the HMAC signature over a canonical string that both sides can compute
 * deterministically without depending on multipart body layout:
 *
 *   v1:{timestamp}:{api_key}:{idempotency_key}:{email_lower}:{job_title_lower}
 *
 * Signature header format: `t=<unix_seconds>,v1=<hex>`.
 * Timestamp must be within ±5 minutes to prevent replay.
 */
export function verifySignature(params: {
  header: string | null;
  secret: string;
  apiKey: string;
  idempotencyKey: string;
  email: string;
  jobTitle: string;
  nowSeconds?: number;
}): { ok: true } | { ok: false; error: string } {
  if (!params.header) return { ok: false, error: "Missing X-Webdura-Signature." };
  const parts = Object.fromEntries(
    params.header.split(",").map((p) => p.trim().split("=") as [string, string]).filter((kv) => kv.length === 2)
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return { ok: false, error: "Malformed signature header." };
  const ts = Number(t);
  if (!Number.isFinite(ts)) return { ok: false, error: "Bad timestamp." };
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 5 * 60) return { ok: false, error: "Signature timestamp expired." };

  const canonical = [
    "v1", String(ts), params.apiKey, params.idempotencyKey,
    params.email.trim().toLowerCase(), params.jobTitle.trim().toLowerCase()
  ].join(":");
  const expected = createHmac("sha256", params.secret).update(canonical).digest();
  let provided: Buffer;
  try { provided = Buffer.from(v1, "hex"); }
  catch { return { ok: false, error: "Signature is not valid hex." }; }
  if (expected.length !== provided.length) return { ok: false, error: "Signature length mismatch." };
  return timingSafeEqual(expected, provided) ? { ok: true } : { ok: false, error: "Signature mismatch." };
}

/**
 * Verify a captcha token. Auto-detects reCAPTCHA v3 or Cloudflare Turnstile
 * based on which env var is set. Skips verification (returns ok) if neither is
 * configured — useful for dev.
 */
export async function verifyCaptcha(token: string | null, remoteIp: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;

  if (!recaptchaSecret && !turnstileSecret) return { ok: true };
  if (!token) return { ok: false, error: "Captcha token missing." };

  const endpoint = turnstileSecret
    ? "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    : "https://www.google.com/recaptcha/api/siteverify";
  const secret = turnstileSecret ?? recaptchaSecret!;

  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  try {
    const res = await fetch(endpoint, { method: "POST", body });
    const data = (await res.json()) as { success: boolean; score?: number; "error-codes"?: string[] };
    if (!data.success) return { ok: false, error: `Captcha failed: ${(data["error-codes"] ?? []).join(",") || "no reason"}` };
    // reCAPTCHA v3 returns a score in [0, 1]; treat < 0.5 as bot.
    if (typeof data.score === "number" && data.score < 0.5) {
      return { ok: false, error: `Captcha score too low (${data.score}).` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Captcha verify error: ${(e as Error).message}` };
  }
}

/** DB-backed rate limit. Returns true if the request is allowed. */
export async function checkRateLimit(apiKey: string, ip: string, limit = 5, windowSeconds = 600): Promise<boolean> {
  const admin = createServiceClient();
  const bucket = `${apiKey}:${ip}`;
  const { data, error } = await admin.rpc("check_intake_rate_limit", {
    p_key: bucket, p_limit: limit, p_window_seconds: windowSeconds
  });
  if (error) return true;  // fail-open — an infra hiccup shouldn't block real applicants
  return Boolean(data);
}
