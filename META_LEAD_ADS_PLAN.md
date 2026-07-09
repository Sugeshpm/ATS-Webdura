# Meta Lead Ads Integration — Implementation Plan

> **Status:** Planning. No code written yet. Awaiting confirmation of open questions before Phase A begins.
> **Belongs to:** Phase 2 (Advanced) per [SPEC.md](./SPEC.md#phase-2--advanced-outline).

---

## 1. Goal

Automatically ingest candidates from **Meta (Facebook + Instagram) Lead Ads** into ATS-Webdura in real time. When someone submits a Lead Ad form on Facebook or Instagram, they should land in the ATS as a candidate at the `Sourced` stage, on the job we've associated with that form, with their contact details, source, and raw form payload preserved for audit.

**Success criterion:** Recruiter posts a Lead Ad on Facebook targeting "React developers", a candidate submits the form on their phone, and within ~30 seconds the candidate appears in `/candidates` with `source=meta_ads` — no manual CSV export needed.

---

## 2. How Meta Lead Ads actually works

Recap of the moving parts, because most of the design flows from these constraints.

### 2.1 The pieces

- **Meta Business Manager** — owns the ad account and pages.
- **Facebook Page** — Lead Ads are attached to a Page (not directly to a Business Manager).
- **Meta App** — a developer app in [developers.facebook.com](https://developers.facebook.com) with the `leads_retrieval` permission. Requires **App Review** before it can pull leads for a Page you don't own for development testing.
- **Ad Campaign → Ad Set → Ad → Lead Form** — the form is defined once, reused across ads. Each form has a `form_id`.
- **Lead** — a single submission. Has a `leadgen_id`, timestamp, and field answers.
- **Access Token** — long-lived Page Access Token (~60 days) needed to call the Graph API and fetch full lead details.

### 2.2 Three ways to receive leads

| Method | Latency | Complexity | Recommendation |
|--------|---------|-----------|----------------|
| **Webhook** — Meta pings your HTTPS endpoint on every submission | Real-time (~seconds) | Medium (HMAC verify + fetch full lead via Graph API) | ✅ **Primary path** for Phase 2 |
| **Graph API polling** — cron pulls `GET /{form-id}/leads` | Delayed (5–60 min) | Low | Fallback + backfill only |
| **CSV export** — download from Meta UI, upload via our existing `/api/candidates/import` | Manual | Zero | Works today, no new code |

Recommendation: build webhook + polling. Polling covers webhook downtime and enables one-click backfill of historical leads.

### 2.3 Webhook flow, end-to-end

```
Candidate fills Facebook Lead Ad
        │
        ▼
Meta stores lead, mints leadgen_id
        │
        ▼
Meta POSTs to  https://ats-webdura.vercel.app/api/integrations/meta/webhook
Payload:  { entry: [{ id: <page_id>, changes: [{ field: "leadgen", value: { leadgen_id, form_id, page_id, created_time } }] }] }
Headers:  X-Hub-Signature-256:  sha256=<HMAC of body using APP_SECRET>
        │
        ▼
Our webhook verifies HMAC, extracts leadgen_id
        │
        ▼
GET https://graph.facebook.com/v20.0/{leadgen_id}?fields=field_data,created_time,form_id&access_token=<PAGE_ACCESS_TOKEN>
        │
        ▼
Response: { field_data: [{ name: "full_name", values: ["Jane Doe"] }, { name: "email", values: ["jane@example.com"] }, …] }
        │
        ▼
Map fields → candidate schema
Look up meta_lead_forms.form_id → job_id
Insert candidates row + applications row (stage = Sourced) + optional meta_leads_raw for audit
        │
        ▼
Candidate visible in /candidates
```

### 2.4 What Meta gives us — vs what our schema expects

| Meta field name (typical) | Candidate column |
|--------------------------|--------------------|
| `full_name` | Split → `first_name`, `last_name` |
| `first_name`, `last_name` | Direct |
| `email` | `email` |
| `phone_number` | `phone` (E.164 if possible) |
| `city`, `state`, `country` | `current_location` (concat) |
| Custom questions | `applications.applied_via_meta` (JSONB, new column) OR discarded |

Meta rarely gives us salary, experience, notice period, or a resume file. Those stay empty. Meta forms **cannot attach files** — resumes will have to be requested in a follow-up (Phase 3).

---

## 3. What exists in the codebase today (touched surface)

Files this feature will reach into:

| File | Why |
|------|-----|
| `supabase/migrations/*.sql` | New migration for `meta_lead_forms`, `meta_leads_raw`, and 2 columns on `candidates` (`external_id`, `external_source`) |
| `src/lib/supabase/admin.ts` | Reused — the webhook handler runs before an authenticated user session, so it uses the service-role client to insert |
| `src/app/api/candidates/import/route.ts` | Reused conceptually — the "map raw row → candidate + application" logic gets extracted into a shared helper so both CSV import and Meta ingest use the same code path |
| `src/app/(app)/settings/page.tsx` | Adds a new "Integrations" card |
| `src/app/(app)/settings/integrations/…` | **New** — index, meta page, forms page, leads log page |
| `src/components/layout/app-sidebar.tsx` | Optional — could surface an Integrations item; more likely stays as a Settings sub-page |
| `.env.local` + Vercel env | New: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_ENCRYPTION_KEY` |

Existing conventions this respects:

- **RLS everywhere.** New tables get `tenant_id` + policies.
- **Server actions for admin config**, route handlers for webhooks.
- **Storage path convention** — not applicable (no files).
- **Audit log.** Every ingested lead writes to `audit_logs`.
- **NDJSON streaming pattern.** Reused for the manual backfill endpoint.

---

## 4. Data model changes

### 4.1 New table: `meta_lead_forms`

Registered Meta Lead forms and their mapping config.

```sql
create table public.meta_lead_forms (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  page_id             text not null,                              -- Facebook Page ID
  page_name           text,                                       -- cached for display
  form_id             text not null,                              -- Meta form ID
  form_name           text,                                       -- cached for display
  job_id              uuid references public.jobs(id) on delete set null,
                                                                  -- form → default job (Option A below)
  field_mapping       jsonb not null default '{}',                -- { meta_field: candidate_column | "custom.*" }
  is_active           boolean not null default true,
  last_synced_at      timestamptz,
  page_access_token_encrypted  bytea,                             -- Page token, encrypted at rest
  page_access_token_expires_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, form_id)
);
create index idx_meta_lead_forms_form on public.meta_lead_forms(form_id);
```

### 4.2 New table: `meta_leads_raw`

Full raw lead payload as returned by Meta's Graph API. Auditable, replayable if mapping changes.

```sql
create table public.meta_leads_raw (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  leadgen_id          text not null,                              -- primary Meta ID for the lead
  form_id             text not null,
  page_id             text not null,
  received_at         timestamptz not null default now(),
  meta_created_time   timestamptz,                                -- when the user submitted on Meta
  raw_payload         jsonb not null,                             -- full response from Graph API
  candidate_id        uuid references public.candidates(id) on delete set null,
  application_id      uuid references public.applications(id) on delete set null,
  status              text not null default 'received',
                       -- received | mapped | inserted | duplicate | failed
  error               text,                                       -- if status='failed'
  unique (tenant_id, leadgen_id)                                  -- de-dupe
);
create index idx_meta_leads_raw_status on public.meta_leads_raw(tenant_id, status);
create index idx_meta_leads_raw_received on public.meta_leads_raw(tenant_id, received_at desc);
```

### 4.3 Existing `candidates` — small additions

```sql
alter table public.candidates
  add column if not exists external_source text,   -- 'meta_lead_ads' | 'linkedin' | ...
  add column if not exists external_id text;       -- the leadgen_id when external_source='meta_lead_ads'
create unique index if not exists uq_candidates_external
  on public.candidates(tenant_id, external_source, external_id)
  where external_source is not null;
```

The unique index gives us idempotent inserts — same `leadgen_id` retried twice by Meta results in a single candidate row (409 upsert on conflict).

### 4.4 RLS

New tables gate on `tenant_id = current_tenant_id()` like every other business table. The webhook handler bypasses RLS via the service-role client since there is no authenticated user context at ingest time — we resolve the tenant from `meta_lead_forms.form_id` lookup.

---

## 5. API surface

### 5.1 Webhook — `/api/integrations/meta/webhook`

**`GET`** — verification handshake, called once by Meta when we configure the subscription.
- Query params: `hub.mode=subscribe`, `hub.verify_token=<our token>`, `hub.challenge=<random>`
- Compare `hub.verify_token` against `process.env.META_WEBHOOK_VERIFY_TOKEN`.
- If match, return `hub.challenge` (200); otherwise 403.

**`POST`** — real-time lead events.
- Verify `X-Hub-Signature-256` HMAC-SHA256 of the raw body using `META_APP_SECRET`. Reject if invalid.
- Body shape: `{ object: "page", entry: [{ id: page_id, changes: [{ field: "leadgen", value: { leadgen_id, form_id, page_id, created_time } }] }] }`.
- For each change of `field === "leadgen"`:
  1. Insert into `meta_leads_raw` with `status='received'`. Unique constraint on `(tenant_id, leadgen_id)` prevents duplicates.
  2. Fire an async ingest job (in-process — no queue infra in Phase 2 yet). Runs the mapping + candidate insert.
- Respond 200 immediately (Meta retries on non-2xx).

### 5.2 Ingest pipeline (internal — called from webhook + backfill)

```ts
async function ingestMetaLead(leadgen_id: string, form_id: string, tenant_id: string) {
  // 1. Look up form config
  // 2. Decrypt page access token
  // 3. GET https://graph.facebook.com/v20.0/{leadgen_id}?fields=...&access_token=...
  // 4. Map field_data → candidate insert payload
  // 5. Upsert candidate on (tenant_id, external_source='meta_lead_ads', external_id=leadgen_id)
  // 6. Insert application (candidate_id, job_id) if form.job_id set
  // 7. Update meta_leads_raw.status = 'inserted' | 'duplicate' | 'failed'
  // 8. Write audit_logs row
}
```

### 5.3 OAuth callback — `/api/integrations/meta/oauth/callback`

For connecting a Meta account. Exchanges code for a user token, then exchanges for a long-lived token, then lists Pages the user manages so the admin can pick which Page(s) to connect.

Simpler alternative (Phase 2 MVP): admin pastes a Page Access Token they generated in the Graph API Explorer. No OAuth flow. Faster to ship, ugly UX.

**Recommendation:** ship the paste-token flow first, wire OAuth in Phase 2.5.

### 5.4 Manual sync — `POST /api/integrations/meta/sync`

- Body: `{ form_id: string, since?: iso_date }`
- Polls `GET /{form_id}/leads?since=<ts>` with pagination.
- Streams NDJSON progress events (same protocol as bulk CSV import).
- Reuses the same `ingestMetaLead` internal function.
- Idempotent — leads already in `meta_leads_raw` skip re-insert.

### 5.5 Leads log — `GET /api/integrations/meta/leads?form_id=&status=&since=`

Read-only. Returns paginated `meta_leads_raw` rows with joined candidate name for the admin log view.

---

## 6. UI surface

Everything under **Settings → Integrations** so we don't clutter the main nav.

### 6.1 `/settings` — new tile

Add an **Integrations** card next to the existing 6 tiles.

### 6.2 `/settings/integrations`

Catalog of available integrations. Phase 2 ships only Meta; the shape scales for LinkedIn/Indeed later.

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Meta Lead Ads   │  │ LinkedIn (P3)   │  │ Naukri (P3)     │
│ Connected ✓     │  │ Coming soon     │  │ Coming soon     │
│ 3 forms · 47 lds│  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 6.3 `/settings/integrations/meta`

- Connect Meta section — either OAuth button (Phase 2.5) or "Paste Page Access Token + Page ID" form.
- Webhook subscription status — shows the verify token, callback URL, and a green/red indicator.
- List of connected Pages.

### 6.4 `/settings/integrations/meta/forms`

- Table of registered forms: Form name · Page · Job · Field mapping (link) · Status · Last synced · Leads (count).
- **Add form** button → dialog with:
  - Page picker
  - Form picker (fetched from `GET /{page_id}/leadgen_forms`)
  - Job dropdown (from `jobs` table, active only)
  - Field mapping editor — three-column table: Meta field name · Candidate column · Sample value
- **Sync now** button per row → runs the manual backfill.

### 6.5 `/settings/integrations/meta/leads`

Recent ingested leads log. Table with: received_at · form · candidate name (linked) · status · error (if failed).

Filters: `form_id`, `status`, date range.

Useful for debugging when a recruiter says "I saw a lead in Meta but it's not in the ATS."

---

## 7. Integration flows

### 7.1 First-time setup (admin, one-off)

```
1. Admin: create Meta App in developers.facebook.com
2. Admin: set the app's Products → Webhooks → Page → subscribe to leadgen
3. Admin: register callback URL = https://ats-webdura.vercel.app/api/integrations/meta/webhook
4. Admin: paste the verify token — Meta pings our GET endpoint, we echo the challenge
5. Admin: submit for App Review with the leads_retrieval permission (takes days-weeks)
6. Admin: generate a long-lived Page Access Token in Graph API Explorer
7. Admin: in ATS /settings/integrations/meta — paste token + page ID
8. ATS: verifies token, fetches page name, lists forms
9. Admin: for each form to sync, click "Register" → pick job → confirm field mapping → save
10. Done. New submissions auto-flow.
```

### 7.2 Ongoing (per candidate submit)

Real-time:

```
1. Candidate submits Meta Lead form
2. Meta POSTs to webhook (≤ few seconds)
3. Webhook verifies HMAC, drops raw event into meta_leads_raw
4. Ingest job runs: fetch full lead via Graph API, map, upsert candidate + application
5. Recruiter sees new candidate in /candidates?view=all, source='meta_lead_ads'
```

Fallback:

```
1. Webhook missed (network flap, deploy in progress)
2. Nightly cron OR manual "Sync now" polls forms since last_synced_at
3. Ingest job runs for any leadgen_ids not already in meta_leads_raw
4. Idempotent — no duplicates
```

### 7.3 GDPR / deletion

- Meta sends a `permissions` webhook event when a user revokes consent (or opts out).
- We should soft-delete or hard-delete matching candidates (Phase 2 stretch — will spec separately).

---

## 8. Prerequisites you must handle before code

Order matters — code can't be tested without these:

1. **Meta Business Manager** account for Webdura.
2. **Webdura Facebook Page** — must exist and be assigned to the Business Manager.
3. **Meta App** created at [developers.facebook.com](https://developers.facebook.com):
   - Add product: Webhooks
   - Add product: Facebook Login (only if we do OAuth in 2.5)
   - App Type: **Business**
   - Add permission: `leads_retrieval` (**needs App Review** — allow 1–3 weeks)
   - Optional now: `pages_show_list`, `pages_manage_ads`, `pages_read_engagement` (needed for OAuth flow)
4. **App Review submission** with:
   - Privacy Policy URL (must be a real hosted policy)
   - Data deletion instructions URL
   - Video demo of how we use `leads_retrieval` (screencast of an admin in Settings → Integrations)
   - Test user credentials for Meta's reviewer
5. **Ad campaign with at least one Lead Ad live** — otherwise there's nothing to test against.
6. **Long-lived Page Access Token** generated via Graph API Explorer.
7. **HTTPS webhook endpoint** — Vercel already provides this at the deployed URL.
8. **Domain verification** in Meta Business Settings (needed for some ad features, not strictly for leads).

Without steps 1–5, we can only build against test data — the real integration can't be enabled.

---

## 9. Environment variables

Added to `.env.local` (dev) and Vercel Project Settings (prod):

| Name | Purpose | Sensitivity |
|------|---------|-------------|
| `META_APP_ID` | Public app ID from Meta Developer dashboard | Public |
| `META_APP_SECRET` | Used to verify webhook HMAC | **Secret** — server-only |
| `META_WEBHOOK_VERIFY_TOKEN` | Random string we invent; echoed in verification handshake | **Secret** |
| `META_ENCRYPTION_KEY` | 32-byte hex key used to encrypt Page access tokens at rest (AES-256-GCM) | **Secret** |
| `META_GRAPH_API_VERSION` | Default `v20.0`; overridable when Meta rolls forward | Public |

---

## 10. Phasing & effort

Each phase self-contained and shippable. Estimates assume one full-stack engineer with AI assist.

### Phase A — Foundation (2 days)
- Migration for `meta_lead_forms`, `meta_leads_raw`, `candidates.external_*`
- Encrypted token store (AES-GCM using `META_ENCRYPTION_KEY`)
- Integrations tile on `/settings` (dead link for now)
- `/settings/integrations/meta` — paste-token connect flow, page name fetch, connection status
- No webhook yet

### Phase B — Webhook receiver (3 days)
- `GET /api/integrations/meta/webhook` verification endpoint
- `POST /api/integrations/meta/webhook` with HMAC verify + queue-less async ingest
- Ingest helper: Graph API client, field mapper, candidate + application upsert
- Audit log writes
- Manual test with `curl` payloads before pointing real Meta at it

### Phase C — Forms admin UI (3 days)
- `/settings/integrations/meta/forms` — table + add form dialog
- Page picker + form picker (calls Graph API from server action)
- Job dropdown + field mapping editor
- Save + test lead ingest end-to-end

### Phase D — Polling backfill + leads log (2 days)
- `POST /api/integrations/meta/sync` — polls Graph API, streams progress
- `Sync now` button on the forms table
- `/settings/integrations/meta/leads` — recent leads log with status filter

### Phase E — Hardening (2 days)
- Rate limiting on webhook (Vercel edge middleware or in-route)
- Token refresh detection (page token expires at 60 days → warn admin)
- Error alerting (log to `audit_logs`; nightly digest — deferred to Phase F)
- Deletion webhook (compliance) — Phase 2 stretch

**Total: ~12 engineering days** to reach production-ready. Real elapsed calendar time is dominated by **Meta App Review** (1–3 weeks) which runs in parallel.

---

## 11. Open questions — need your input before coding

1. **Form ↔ job mapping strategy?**
   - (A) One form → one job (simplest; picked in the form's config)
   - (B) A custom question on the Meta form asks "Which role?" — we map answer to job
   - (C) Ad-name convention decides (fragile)
   - **My recommendation:** (A) for MVP; add (B) as a Phase 2.5 nicety.

2. **Duplicate policy?**
   - Same email applies via Meta twice to the same form — one candidate row or two?
   - Same email applies via Meta to form A, then form B (different jobs) — one candidate + two applications, or two candidates?
   - **My recommendation:** dedupe on `(tenant_id, email)` → one candidate; add a second `applications` row.

3. **Auto-approve or hold for review?**
   - Meta leads land straight in `Sourced`, or in a new `Pending Review` category first?
   - **My recommendation:** straight into `Sourced` (matches recruiter expectation); add a "Meta-sourced" tag they can filter by.

4. **Custom questions storage?**
   - Meta forms often have 2–5 custom questions ("Notice period?", "Current CTC?", etc.).
   - **Options:** (a) drop them, (b) store in `applications.applied_via_meta` JSONB, (c) map to typed columns (`notice_period_days` etc.).
   - **My recommendation:** (b) — flexible JSONB payload; add typed mappings later if patterns emerge.

5. **How many Facebook Pages will we connect?**
   - One Webdura page — simplest.
   - Multiple (regional pages, brand pages) — schema supports it; UI needs a page selector.
   - **Please confirm** — this affects UI complexity.

6. **OAuth or paste-token?**
   - **My recommendation:** ship paste-token in Phase 2; add OAuth in Phase 2.5 only if needed.

7. **Notification when a lead arrives?**
   - Toast to online admins? Email digest? Slack? Or nothing (they discover via the list)?
   - **My recommendation:** nothing in Phase 2; add Slack in Phase 3.

8. **Retention of raw payloads?**
   - `meta_leads_raw` rows never delete? 90 days? 1 year?
   - Meta ToS requires we support user-deletion requests.
   - **My recommendation:** keep forever until a deletion event arrives; then hard-delete.

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **App Review is rejected** | Medium | High — blocks ingest | Submit early with a clear privacy policy and screencast. Have polling fallback so CSV import still works. |
| **Page access token expires** (60 days) | Certain | Medium — no leads until refreshed | Detect via 401 from Graph API, alert admin, allow re-paste. Long-term: implement OAuth refresh. |
| **Webhook missed leads** during deploy | Low | Low — Meta retries a few times | Idempotent inserts + nightly polling reconciliation. |
| **Graph API rate limits** | Low at Webdura scale | Medium | Batch Graph calls; back off on 429. |
| **PII compliance** — Meta ToS | Medium | High — could lose ad account | Encrypt tokens at rest, honour deletion, publish a Privacy Policy. |
| **Custom questions vary per form** | High | Low | JSONB payload absorbs the variability. |
| **Malicious webhook spoofing** | Low | High | Strict HMAC verification; reject any body without valid `X-Hub-Signature-256`. |

---

## 13. Test plan

Ordered milestones. Every previous test passes before moving to the next.

- [ ] **Local echo test** — start dev server, `curl -X POST http://localhost:3000/api/integrations/meta/webhook` with a hand-crafted body + correct HMAC → returns 200 and inserts a `meta_leads_raw` row.
- [ ] **Verification handshake** — hit `GET /api/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=<match>&hub.challenge=xyz123` → returns `xyz123`.
- [ ] **HMAC rejection** — same POST with wrong signature → 403.
- [ ] **Admin adds form** — pick job, save field mapping, table row appears.
- [ ] **Meta test lead** — use Meta's "Test on Facebook" tool inside the Lead Ad form editor → real leadgen_id fires webhook → candidate appears in `/candidates` with `source=meta_lead_ads`, correct job in applications.
- [ ] **Duplicate leadgen_id** — replay the same webhook body → no second candidate row, `meta_leads_raw.status='duplicate'`.
- [ ] **Manual sync** — click Sync Now → previously-missed leads ingest in NDJSON stream.
- [ ] **Token expired** — force 401 → admin sees red status in `/settings/integrations/meta`, no crashes.
- [ ] **RLS check** — a second tenant cannot see other tenant's forms/leads via SQL (via a manual query).
- [ ] **Load test** — 100 rapid webhook posts → all ingest without race conditions (or duplicates thanks to unique index).

---

## 14. Out of scope for Phase 2

Explicitly deferred to keep the phase shippable:

- **OAuth connection flow** — pastable token is fine for the first Webdura Page.
- **Auto-refresh page tokens** — will manually re-paste on expiry.
- **Multi-tenant onboarding flow** for external customers — irrelevant, we're single-tenant in production.
- **Custom-field-mapped questions** to typed candidate columns — start with JSONB, refactor if patterns emerge.
- **Instagram Lead Ads** — same webhook works for IG lead ads, but validate the Meta App has Instagram permission separately.
- **Bulk historical import** for pre-existing Meta leads older than 90 days — Meta only exposes recent leads via API; older ones need CSV.
- **Resume file collection** — Meta forms can't attach files. Follow-up email/SMS deferred to Phase 3.
- **Real-time notifications** (Slack, email) when a lead arrives — Phase 3.
- **Analytics dashboard** — leads-per-form, cost-per-lead, conversion-to-hire — Phase 3.

---

## 15. Files a developer will create in Phase 2

For reference — no code changes until questions in §11 are answered.

**New migrations:**
- `supabase/migrations/…13_meta_integration.sql` — three tables + candidate columns

**New library code:**
- `src/lib/meta/graph.ts` — thin Graph API client (fetch lead by ID, list forms, list pages, list leads for form)
- `src/lib/meta/webhook.ts` — HMAC verify, payload parser
- `src/lib/meta/ingest.ts` — map raw → candidate + application; the one shared function called from both webhook and polling
- `src/lib/crypto/encrypt.ts` — AES-GCM helpers for token at rest

**New routes:**
- `src/app/api/integrations/meta/webhook/route.ts`
- `src/app/api/integrations/meta/sync/route.ts`
- `src/app/api/integrations/meta/oauth/callback/route.ts` (Phase 2.5)

**New UI pages:**
- `src/app/(app)/settings/integrations/page.tsx`
- `src/app/(app)/settings/integrations/meta/page.tsx`
- `src/app/(app)/settings/integrations/meta/forms/page.tsx`
- `src/app/(app)/settings/integrations/meta/leads/page.tsx`

**Modified:**
- `src/app/(app)/settings/page.tsx` — add Integrations tile
- `src/app/(app)/candidates/[id]/page.tsx` — surface "Meta lead" badge if `external_source='meta_lead_ads'`

---

## 16. What I need from you to move to code

Answer the 8 questions in §11, confirm the phasing is right, and confirm you have started (or scheduled) the Meta App creation + review in §8. Once those are set, Phase A can start.

*(Design questions can also be resolved by picking my recommendations if you have no strong preferences.)*
