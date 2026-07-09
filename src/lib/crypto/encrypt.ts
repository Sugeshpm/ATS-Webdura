import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets at rest (Meta Page access tokens).
 * Storage format: base64(iv(12) || tag(16) || ciphertext)
 */

function loadKey(): Buffer {
  const hex = process.env.META_ENCRYPTION_KEY;
  if (!hex) throw new Error("META_ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32`.");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("META_ENCRYPTION_KEY must be 32 bytes (64 hex chars).");
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = loadKey();
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("Ciphertext too short.");
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct  = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * HMAC-SHA256 for Meta webhook signature verification.
 * Meta sends: X-Hub-Signature-256: sha256=<hex>
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader);
  if (!match) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(match[1], "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
