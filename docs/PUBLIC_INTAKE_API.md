# Public Intake API — WordPress Careers → HRM

Push new job applications (candidate + resume) from any external site (Webdura
WordPress careers page, Framer, static HTML form) into the HRM. One HTTPS
request per submission; no polling; no shared database.

## Endpoint

```
POST https://ats-webdura.vercel.app/api/public/applications
```

- **Content-Type**: `multipart/form-data` (so the resume file rides along in the
  same request — no signed-URL step)
- **Method**: `POST` only. `OPTIONS` is supported for CORS preflight.

## Authentication

Every request must include an **API key** (public) and an **HMAC-SHA256
signature** (proof of the shared secret) as headers. Keys are provisioned per
tenant in the HRM `public_intake_credentials` table.

| Header | Required | Purpose |
| --- | :---: | --- |
| `X-Webdura-Api-Key` | ✅ | Identifies the tenant/integration. Public. |
| `X-Webdura-Signature` | ✅ | `t=<unix_seconds>,v1=<hmac_sha256_hex>` over the canonical string (see below). |
| `X-Webdura-Idempotency` | ✅ | A UUID/GUID the caller mints per submission. Replaying the same key returns the first response instead of creating a second record. |
| `X-Webdura-Origin` | Optional | The URL of the page hosting the form. Used for the origin allowlist. Falls back to the browser's `Origin` header. |

### Signature — canonical string

Both sides compute this string identically, so multipart body layout is
irrelevant:

```
v1:{timestamp}:{api_key}:{idempotency_key}:{email_lower}:{job_title_lower}
```

- `timestamp` — unix seconds; must be within ±5 minutes of server time
- `email_lower`, `job_title_lower` — trimmed + lowercased exactly as sent in the form
- Compute `HMAC-SHA256(canonical, api_secret)` → hex-encode → put in `v1=`

Bad signature returns `401 bad_signature`.

## Request fields (multipart form-data)

| Field | Type | Required | Notes |
| --- | --- | :---: | --- |
| `full_name` | text | ✅ | Split server-side: first token = first name, rest = last name |
| `email` | text | ✅ | Must be valid email |
| `phone` | text | ✅ | `+` and digits, 7–20 chars |
| `experience_years` | number | ✅ | 0–60 |
| `job_title` | text | ✅ | Matched case-insensitively against `jobs.title` for the tenant. Falls back to `default_job_id` on the credential if no match. |
| `resume` | file | ✅ | PDF/DOC/DOCX/RTF/TXT, ≤ 10 MB |
| `source` | text | ❌ | Defaults to `wordpress_careers` |
| `captcha_token` | text | Conditional | Required only if HRM has `RECAPTCHA_SECRET_KEY` or `TURNSTILE_SECRET_KEY` set |
| `website_url` | text | ❌ | **Honeypot** — leave empty. Any value = spam-rejected. |

## Response

### 200 OK — success

```json
{
  "ok": true,
  "duplicate": false,
  "reference": "APP-A1B2C3D4",
  "candidate_id": "…uuid…",
  "application_id": "…uuid…",
  "resume_attached": true
}
```

- `duplicate: true` — the candidate already had an application for this job.
  The response still returns 200 so WP can show a friendly "you already applied"
  message. No new record created.
- `reference` — first 8 chars of the idempotency key, upper-cased. Show it on
  the thank-you page so the applicant can quote it.
- `replay: true` (extra field) — this request had the same `X-Webdura-Idempotency`
  as an earlier success; the same response is being returned again.

### 4xx / 5xx — error envelope

```json
{
  "ok": false,
  "code": "validation_failed",
  "error": "One or more fields are invalid.",
  "fields": { "email": "Valid email is required." }
}
```

| Status | `code` | Meaning |
| :---: | --- | --- |
| 400 | `bad_form` | Body isn't multipart/form-data |
| 400 | `missing_idempotency` | `X-Webdura-Idempotency` header not provided |
| 400 | `validation_failed` | One or more form fields invalid (see `fields`) |
| 400 | `spam_suspected` | Honeypot filled in |
| 401 | `missing_api_key` | `X-Webdura-Api-Key` header not provided |
| 401 | `invalid_api_key` | API key not found, revoked, or inactive |
| 401 | `bad_signature` | Signature header missing/malformed/mismatched, or timestamp too old |
| 403 | `origin_not_allowed` | Origin header not in `allowed_origins` for this credential |
| 403 | `captcha_failed` | reCAPTCHA/Turnstile verification failed |
| 422 | `intake_failed` | Insert failed (e.g. no job matched and no default) — see `error` |
| 429 | `rate_limited` | > 5 submissions from one IP in 10 minutes |
| 500 | `internal_error` | Unexpected server error — retry with exponential backoff |

**Retry rule for the caller**: retry only on 5xx or network errors, up to 6 times
with exponential backoff. Never retry on 4xx (except 429, which respects the
window).

## Duplicate detection

Two levels:

1. **Idempotent replay** — same `X-Webdura-Idempotency` value → returns the
   original response with `replay: true`. Prevents double-clicks and network
   retries from creating duplicate rows.
2. **Duplicate candidate** — matched by `(tenant_id, email)`. If the candidate
   already applied to the same job → response is 200 with `duplicate: true` and
   no new application row is created. If they applied to a different job, a new
   application is linked to the existing candidate record.

## Rate limits

- **5 submissions per (API key, IP) per 10 minutes**, hard cap
- Enforced by the `check_intake_rate_limit()` Postgres function (atomic upsert)
- Exceeded → `429 rate_limited`. There is no `Retry-After` header yet; the
  bucket resets 10 min after the first request in the current window.

## Logging & audit

Every request — success or failure — writes a row to `applications_intake_log`:

```
id, tenant_id, api_key, idempotency_key, ip, origin, status, outcome,
candidate_id, application_id, error, request_summary, response_summary, created_at
```

Tenant staff can read their own rows (RLS scoped to their `tenant_id`); the
audit trail is what you use to trace "did this application come through?"

## Provisioning a credential

For now, insert credentials via SQL. In a follow-up we'll add a Settings page.

```sql
-- Run in Supabase SQL editor. Replace the placeholders.
insert into public.public_intake_credentials
  (tenant_id, name, api_key, api_secret_encrypted, default_job_id, allowed_origins)
values (
  '<tenant-uuid>',
  'Webdura WP Careers',
  'wp_' || encode(gen_random_bytes(16), 'hex'),      -- returns the api_key you copy to WP
  '',                                                 -- fill via the encrypt helper below
  '<fallback-job-uuid or null>',
  array['https://webdura.in']
)
returning api_key;
```

Encrypting the secret is easiest via a one-off Node script since it needs
`META_ENCRYPTION_KEY`:

```js
// scripts/encrypt-intake-secret.mjs
import { readFileSync } from "node:fs";
import { createCipheriv, randomBytes } from "node:crypto";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).map(l=>l.split("=")).filter(a=>a.length===2));
const key = Buffer.from(env.META_ENCRYPTION_KEY, "hex");
const secret = process.argv[2];                     // pass your random secret as argv
const iv = randomBytes(12);
const c = createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([c.update(secret,"utf8"), c.final()]);
const tag = c.getAuthTag();
console.log(Buffer.concat([iv, tag, ct]).toString("base64"));
```

Run: `node scripts/encrypt-intake-secret.mjs "$(openssl rand -hex 32)"`, then
paste both the plaintext secret (for WP) and the encrypted output (for the SQL
update statement).
