# CLAUDE.md — ATS-Webdura agent brief

Terse, structured, scannable. Re-read this every session.

---

## What this project is

**ATS-Webdura** — an in-house applicant tracking system for Webdura Technologies. Next.js 15 App Router + Supabase (Postgres + Auth + Storage + RLS). Deployed at `ats-webdura.vercel.app`. Phase 1 shipped; daily use by the HR team.

**One repo. One product. One tenant in production (multi-tenant in schema).**

---

## Session startup checklist

Run these before touching code:

```bash
# 1. In the project root
cd C:/xampp/htdocs/ATS-Webdura

# 2. Confirm the tree is clean and dependencies installed
git status && ls node_modules/.package-lock.json 2>/dev/null || npm install

# 3. Confirm build still passes on `main`
npm run build

# 4. Confirm Supabase CLI is linked (only needed if migrations are touched this session)
npx supabase status || echo "not linked — run `npx supabase link --project-ref rlspryfcbzmthiqbwsyz` if you plan to push migrations"

# 5. Confirm Vercel auth if deploying
gh auth status 2>/dev/null && vercel whoami 2>/dev/null
```

If any of these fail, fix them before writing code.

---

## Architecture summary

Single Next.js 15 app with an app-shell layout: dark left sidebar (`bg-brand-header`, `#0F172A`) + white content area on a light body (`#F8FAFC`). Nav: **Dashboard · Jobs · Candidates · Reports · Settings**.

Routes:

- `(auth)/` — public — login, signup, forgot, reset, callback
- `(app)/` — authenticated — dashboard, jobs, candidates, reports, settings
- `api/` — CSV export/import/template route handlers

Full architecture in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Auth model — READ THIS

**Approval-based single-tenant workflow.** Enforced in three places (all three must stay in sync):

1. **DB trigger `handle_new_user`** on `auth.users` insert:
   - First-ever user (`tenants` table empty) → creates tenant + `role='super_admin'`, `status='active'`.
   - User invited by admin (metadata `invited_by_admin=true`) → lands in inviter's tenant, `status='invited'`.
   - Anyone else → sole existing tenant, `role='recruiter'`, **`status='pending'`**.

2. **`loginAction`** (`src/app/(auth)/login/actions.ts`) — after sign-in, reads `profiles.status`:
   - `pending` / `rejected` / `disabled` → signs out, redirects to `/login?status=<value>` with a labelled banner.
   - `invited` → auto-promotes to `active` and stamps `last_login_at`.
   - `active` → allowed to proceed.

3. **`(app)/layout.tsx`** — on every authenticated page render:
   - Re-reads `profiles.status`. If not `active` or `invited`, signs out and redirects to `/login?status=<value>`.
   - This catches mid-session status changes (e.g. admin disables a logged-in user).

**Cookie domain:** Supabase's default (root domain of the deployment). No cross-subdomain cookies.

**Roles:** `super_admin | admin | hiring_manager | recruiter | interviewer | dept_head | vendor`. Admins = `super_admin` and `admin`. Only admins see the invite form + approve/reject actions in `/settings/users`.

---

## Multi-tenant + RLS

Every business table has a `tenant_id` column. RLS policies use two `SECURITY DEFINER` helpers:

- `public.current_tenant_id()` → returns the current user's `tenant_id` (from `profiles`, keyed by `auth.uid()`).
- `public.is_admin()` → returns true if the current user's role is `super_admin` or `admin`.

Cross-table gates (needed to break recursion between `jobs` and `job_team`):

- `public.is_on_job_team(job_id)` — used in `jobs_tenant_select` for the confidential-job check.
- `public.job_in_my_tenant(job_id)` — used in `job_team` policies.
- `public.interview_in_my_tenant(interview_id)` — same pattern for `interview_panel`.

**Never** query `job_team` from a jobs RLS policy directly (or vice versa) — it triggers infinite recursion. Use the definer helpers.

---

## Key database tables

Snapshot of the ones an agent hits most often. Full schema is under [`supabase/migrations/`](./supabase/migrations/).

```
tenants                 (id, name, slug, logo_url, primary_color, time_zone)
profiles                (id ↔ auth.users, tenant_id, email, first_name, last_name, role, status, last_login_at)
                          -- status ∈ pending | active | invited | disabled | rejected
                          -- role   ∈ super_admin | admin | hiring_manager | recruiter | interviewer | dept_head | vendor

jobs                    (id, tenant_id, title, department_id, location_id, business_unit_id,
                         status, visibility, confidential, priority, openings, hires,
                         experience_min/max, salary_min/max, salary_currency,
                         description (HTML), skills text[], target_close_date, created_by)
                          -- status ∈ draft | active | archived | closed

job_team                (job_id, user_id, role_on_job)
                          -- role_on_job ∈ hiring_manager | recruiter | interviewer | approver

candidates              (id, tenant_id, first/middle/last_name, email, phone,
                         current_company, current/preferred_location, experience_years/months,
                         current_salary(+currency), expected_salary(+currency),
                         source, owner_id, category, updated_at)
                          -- category ∈ active | talent_pool | archived | duplicate  (replaced is_archived in mig 12)

applications            (id, tenant_id, candidate_id, job_id, current_stage_id, applied_at, is_archived,
                         applied_via, created_by, updated_at)
                          -- unique (candidate_id, job_id)
                          -- is_archived here is APPLICATION-level, distinct from candidates.category

application_stage_history (id, application_id, from_stage_id, to_stage_id, moved_by, comment, moved_at)
                          -- NO tenant_id column; RLS gates via parent application

stages                  (id, tenant_id, code, name, order, color, is_terminal, is_archived)
                          -- 11 seeded per tenant on insert (via seed_default_stages trigger)

candidate_skills        (candidate_id, skill_id)         -- gate via candidates in RLS
candidate_experiences   (id, candidate_id, company, title, start_date, end_date, is_current, description)
candidate_educations    (id, candidate_id, institution, degree, field, start_year, end_year, grade)

documents               (id, tenant_id, candidate_id, application_id, kind, name, mime, size_bytes,
                         storage_bucket, storage_path, uploaded_by, version)
                          -- kind ∈ resume | cover_letter | offer_letter | id_proof | certificate | other

notes                   (id, tenant_id, application_id, author_id, body, created_at)

audit_logs              (id, tenant_id, actor_id, action, entity, entity_id, before jsonb, after jsonb, created_at)
                          -- move_candidate_category writes here per row

interviews              (id, tenant_id, application_id, stage_id, mode, scheduled_start, scheduled_end,
                         location_or_link, status, created_by)
                          -- mode ∈ online | onsite | phone; status ∈ scheduled | completed | cancelled | no_show

feedback                (id, tenant_id, application_id, stage_id, interview_id, template_id,
                         submitted_by, submitted_at, score, decision, payload jsonb)

messages                (id, tenant_id, application_id, channel, direction, from_user_id, subject, body,
                         attachments jsonb, provider_message_id, sent_at)

templates               (id, tenant_id, kind, name, subject, body, variables jsonb, is_default)
                          -- kind ∈ email | whatsapp | job_description | offer_letter | scorecard | application_form
```

Views + RPCs used by the app:

- `v_jobs_with_counts` — jobs joined with department/location/BU names + `candidate_count`, `new_candidates_count`, `archived_candidates_count`.
- `move_application_stage(app_id, stage_id, comment)` — atomic stage move + history insert.
- `job_funnel(job_id)` — counts per stage for that job.

---

## Integration contracts

**`POST /api/{candidates,jobs}/import`** — streams NDJSON. Events: `start` (total) → `row` (index, name, status, reason?) → `done` (inserted, skipped, failures[]). Client parses full CSV, splits into 100-row batches, and POSTs each batch separately to survive Vercel timeouts.

**`POST /auth/callback?code=…&next=…`** — Supabase code-exchange. When `next` starts with `/reset-password`, the callback appends `?invited=1` so the reset form shows the invitation-onboarding copy.

No external APIs consumed. No webhooks fired.

---

## Tech stack

| Layer | Tool |
|-------|------|
| Framework | Next.js **15.5.19** (App Router) |
| Language | TypeScript strict |
| UI | React 19 + TailwindCSS 3.4 |
| Components | Local shadcn-style primitives under `src/components/ui/` |
| Rich text | TipTap 3 (StarterKit + Link extension) |
| Forms | react-hook-form + zod + react-dropzone |
| CSV | papaparse (client + server) |
| Auth SDK | `@supabase/ssr` + `@supabase/supabase-js` |
| Icons | lucide-react |
| Toasts | Sonner |
| DB | Supabase Postgres 16 |
| Deploy | Vercel |

---

## Repo map (on disk)

Project root: **`C:/xampp/htdocs/ATS-Webdura/`**

```
├── BRIEF.md · ARCHITECTURE.md · SPEC.md · README.md · CLAUDE.md · STATUS.md
├── package.json · next.config.ts · tailwind.config.ts · tsconfig.json
├── middleware.ts (routes auth-gating)
├── public/
│   ├── images/logo.png                     (Webdura logo — red W + white "WEBDURA")
│   ├── Resumes/<job title>/<candidate>...  (imported resume files for bulk CSV mapping)
│   └── candidates-template.csv             (sample template)
├── src/
│   ├── app/
│   │   ├── globals.css                    (palette: #F8FAFC bg, #EF4444 primary, sidebar #0F172A)
│   │   ├── layout.tsx                     (root HTML shell)
│   │   ├── (auth)/{login,signup,forgot,reset}/…
│   │   ├── (app)/                         (all authenticated routes)
│   │   │   ├── layout.tsx                 (AppShell — sidebar + top header + status gate)
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── jobs/{page.tsx, new/page, [id]/page, [id]/edit/page}
│   │   │   ├── candidates/{page, [id]/page, loading, layout, actions.ts}
│   │   │   ├── reports/page.tsx
│   │   │   └── settings/{page, organisation, users, departments, locations, stages, templates}
│   │   ├── api/{jobs,candidates}/{import,export,template}/route.ts
│   │   └── auth/callback/route.ts
│   ├── components/
│   │   ├── ui/                            (shadcn primitives: button, input, dialog, sheet, badge, …)
│   │   ├── layout/                        (app-shell, app-sidebar, app-header)
│   │   ├── jobs/                          (job-card, jobs-grid, wizard, edit form, tabs/…)
│   │   ├── candidates/                    (table, sidebar, sub-tabs, drawers, detail components)
│   │   ├── settings/back-link.tsx
│   │   └── shared/bulk-actions.tsx        (import dialog with streaming progress)
│   └── lib/
│       ├── supabase/{client,server,middleware,admin}.ts
│       ├── types/database.ts              (placeholder — regenerate via `npm run db:types`)
│       ├── csv.ts                         (toCsv, parseCsv, num, bool helpers)
│       └── utils.ts                       (cn, initials, formatDate)
└── supabase/
    ├── config.toml
    └── migrations/
        ├── 20260623000001_init.sql
        ├── 20260623000002_org_setup.sql
        ├── 20260623000003_jobs.sql
        ├── 20260623000004_candidates.sql
        ├── 20260623000005_interactions.sql
        ├── 20260623000006_rls.sql
        ├── 20260623000007_storage.sql
        ├── 20260623000008_views.sql
        ├── 20260623000009_templates.sql
        ├── 20260623000010_fix_rls_recursion.sql
        ├── 20260623000011_approval_flow.sql
        └── 20260623000012_candidate_categories.sql
```

---

## Environment variables

Set in `.env.local` (dev) and Vercel Project Settings (prod). See `.env.local.example` for copy targets.

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used **only** in `src/lib/supabase/admin.ts` for invite flows. **Never expose to client.** |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://ats-webdura.vercel.app` — used in signup/invite redirects |
| `META_APP_ID` | Public app ID from Meta developer dashboard (Lead Ads integration) |
| `META_APP_SECRET` | **Secret** — used to verify webhook HMAC (`X-Hub-Signature-256`) |
| `META_WEBHOOK_VERIFY_TOKEN` | **Secret** — echoed during Meta's webhook handshake |
| `META_ENCRYPTION_KEY` | **Secret** — 32-byte hex key for AES-256-GCM encryption of Page access tokens at rest |
| `META_GRAPH_API_VERSION` | Default `v20.0` — overridable when Meta rolls forward |

Supabase Auth → URL Configuration must include the site URL and `/auth/callback` in Redirect URLs, or Supabase refuses the redirect after invite acceptance.

---

## Key constraints (things to never break)

1. **RLS is authorisation.** Every write goes through the user's session. The only service-role client lives in `src/lib/supabase/admin.ts` and is used exclusively for `auth.admin.inviteUserByEmail`.
2. **Storage path convention: `<tenant_id>/<candidate_id>/<file>`.** Bucket policies verify the first path segment matches the caller's tenant. Do not upload to arbitrary paths.
3. **`candidates.category` is the source of truth** for talent-pool / archived / duplicate. `candidates.is_archived` was dropped in migration 12 — do not re-add it.
4. **`applications.is_archived` still exists** and is a *separate* concept (per-job application archive). Do not conflate with candidate category.
5. **Descriptions are stored as HTML** (TipTap output). Read with `RichTextView`; write via `RichTextEditor`.
6. **Serverless-timeout aware.** Any operation that could exceed 30s (bulk import, mass moves) must chunk client-side.
7. **No hard-coded URLs.** Use `NEXT_PUBLIC_SITE_URL` for redirects.
8. **Bootstrap = first user.** Never manually seed a super_admin; the trigger handles it.
9. **RLS recursion guard.** `jobs` ↔ `job_team` (and their cousins) require the SECURITY DEFINER helpers `is_on_job_team`, `job_in_my_tenant`, `interview_in_my_tenant`. Don't inline `exists (select … from job_team)` in a `jobs` policy.
10. **Server components fetch, client components mutate.** Every list page is `async`; interactivity lives behind `"use client"` leaves.

---

## Guiding principles (non-obvious decisions)

- **Candidate is the root entity.** A candidate can exist without any application (talent pool). All category-scoped filters live on `candidates.category`, not on an application flag.
- **Bootstrap-first single-tenant.** The schema is multi-tenant but the product is not marketed to third parties. Do not remove `tenant_id`.
- **Chunked import over background jobs.** No queue infra in Phase 1. Client chunking is enough and keeps the codebase small.
- **Light body + dark sidebar** is the deliberate premium-SaaS split (Linear, Ashby). Don't dark-mode the body.
- **URL-driven state.** Sub-tabs (candidates, job detail) use `?tab=…` and `?stage=…` instead of client state, so links are shareable.
- **NDJSON over WebSockets.** For import progress. Simpler, works with Vercel serverless, no persistent connection needed.
- **Optimistic UI deferred.** Every mutation uses `router.refresh()`. Optimistic UI is a Phase 2 polish item — don't add it without a case-by-case decision.

---

## Common commands

```bash
npm run dev                            # local dev server (port 3000)
npm run build                          # production build; must pass before merging
npm run typecheck                      # tsc --noEmit
npm run lint                           # next lint (enforced in CI later)

npx supabase db push                   # apply pending migrations
npm run db:types                       # regenerate src/lib/types/database.ts from live schema
```

---

## What NOT to put in this document

- Feature requirements — those belong in [SPEC.md](./SPEC.md).
- Git history — `git log` is authoritative.
- Debugging solutions — those belong in commit messages.
- General coding conventions — the agent should derive from the codebase.
