# ARCHITECTURE — ATS-Webdura

> **Answers:** *How is this built — what are the pieces and how do they connect?*

---

## Product map

Single Next.js 15 (App Router) application with an app-shell layout (dark left sidebar + white content area). One product, no sub-domains.

| Module | Path | What it does |
|--------|------|-------------|
| **Dashboard** | `/dashboard` | KPI tiles, hiring pipeline overview, recent activity, upcoming interviews. |
| **Jobs** | `/jobs` | Grid of jobs with filters; create wizard; edit form; detail page with 3 tabs (Dashboard / Candidates / Description). |
| **Candidates** | `/candidates` | 5 sub-tabs (My / All / Talent Pool / Archived / Duplicates), left sidebar (owned filters + active-jobs list), toolbar + table. Detail page with 7 tabs (Profile / Resume / Documents / Activity / Notes / Feedback / Communication). |
| **Reports** | `/reports` | Job funnel view. Placeholder for source effectiveness / time-to-hire in Phase 2. |
| **Settings** | `/settings/{organisation, users, departments, locations, stages, templates}` | Org config, user approvals + invites, org-setup CRUD, email/WhatsApp/offer templates. |
| **Auth flow** | `/login, /signup, /forgot-password, /reset-password, /auth/callback` | Approval-based signup, invite acceptance, magic-link + password flows. |
| **API routes** | `/api/{jobs,candidates}/{export,import,template}` | CSV export / streaming NDJSON import / template download. |

## User access model

Seven roles. `super_admin` is created only for the very first user of a fresh install (bootstrap). All subsequent signups are `pending` until an admin approves them.

| Role | Access boundary |
|------|-----------------|
| `super_admin` | Everything, including managing admins. First user only. |
| `admin` / HR Head | Manage users, org config, all candidates + jobs. |
| `hiring_manager` | Jobs in own department; feedback on candidates; approvals. |
| `recruiter` | Full candidate + application lifecycle for assigned jobs. |
| `interviewer` | Read candidates assigned to them; submit feedback. |
| `dept_head` | Read-only on department's pipeline + reports. |
| `vendor` | Reserved for Phase 3 (agency portal). Not used yet. |

**Approval workflow (Phase 1 is single-tenant):**

```
first-ever signup ──► super_admin, status = active
subsequent signup ──► role = recruiter, status = pending  (blocked at login)
admin invite     ──► role = <chosen>, status = invited
   └── invitee sets password ──► status = active
admin approve   ──► status = active
admin reject    ──► status = rejected  (blocked at login)
admin disable   ──► status = disabled  (blocked at login)
```

Enforced in three places:
1. `loginAction` — after sign-in, checks status; signs out non-active users with a labelled redirect.
2. `(app)/layout.tsx` — every authenticated page load re-checks status.
3. Postgres — RLS gates writes per `tenant_id`; the DB trigger `handle_new_user` sets initial role + status.

## Data model overview

Single Supabase Postgres project. Multi-tenant at the schema level via a mandatory `tenant_id` column on every business table plus RLS policies. Currently only one tenant will exist in production, but the schema does not assume that.

**Table families:**

```
tenants ──┬── profiles (auth.users linked)
          ├── departments / business_units / locations
          ├── stages (default 11 seeded on tenant creation)
          ├── skills / tags
          │
          ├── jobs ──┬── job_team (M2M with profiles)
          │         └── job_stage_config
          │
          ├── candidates ─── category ∈ {active, talent_pool, archived, duplicate}
          │       │
          │       ├── candidate_experiences / candidate_educations
          │       ├── candidate_skills / candidate_tags
          │       ├── applications ─── one per (candidate, job) pair
          │       │     │
          │       │     ├── application_stage_history
          │       │     ├── interviews (+ interview_panel M2M with profiles)
          │       │     ├── feedback
          │       │     ├── messages
          │       │     └── notes
          │       │
          │       └── documents (resume, offer_letter, id_proof, other)
          │
          ├── templates (email, whatsapp, offer_letter, scorecard, job_description)
          ├── notifications (per-user, in-app)
          └── audit_logs (actor, action, before, after)
```

`candidates.category` replaced the old `is_archived` boolean in migration 12. Multi-value category enables the four side-tabs on the Candidates page.

## Storage

Three private Supabase buckets:

| Bucket | Path convention | Access |
|--------|-----------------|--------|
| `resumes` | `<tenant_id>/<candidate_id>/<timestamp>-<filename>` | Read/write for members of the tenant (path prefix must match `current_tenant_id()`). |
| `documents` | Same convention | Offer letters, IDs, certificates. |
| `avatars` | `<user_id>/<filename>` | Public read; write only by owner. |

Signed URLs (30-min TTL) are minted server-side for resume preview + download.

## Shared infrastructure

| Layer | Service |
|-------|---------|
| Auth (cookies, JWT, magic link, password reset) | Supabase Auth |
| Database | Supabase Postgres 16 |
| File storage | Supabase Storage |
| Real-time (planned) | Supabase Realtime (not used in Phase 1) |
| Rich text editor | TipTap 3 (StarterKit + Link) |
| CSV parsing | Papaparse (server + client) |
| Icons | lucide-react |
| Toasts | Sonner |
| Deployment | Vercel (`ats-webdura.vercel.app`) |
| Build tool | Next.js compiler + SWC + Turbopack (dev) |

No external APIs, webhooks, message brokers, or background job runners in Phase 1.

## Integration contracts

**Internal only in Phase 1.** No public API surface. Everything flows through Next.js server components + server actions + `/api/*` route handlers.

The one contract that matters:

**`/api/{candidates,jobs}/import` (POST)** — streams `application/x-ndjson`:
```jsonl
{"type":"start","total":100}
{"type":"row","index":0,"name":"Alfina L","status":"ok","resume":"uploaded"}
{"type":"row","index":1,"name":"Karanjit","status":"skip","reason":"no matching job for …"}
{"type":"done","total":100,"inserted":95,"skipped":5,"resumes_uploaded":78,"failures":[…]}
```

Client chunks the CSV into batches of 100 rows and posts each batch as a separate POST; the client re-assembles progress and failure lists across batches. This works around Vercel's serverless timeout without needing a queue.

## Tech stack

| Layer | Tool |
|-------|------|
| Framework | Next.js **15.5.19** (App Router, Server Actions, RSC) |
| Language | TypeScript strict |
| UI runtime | React 19 |
| Styling | TailwindCSS 3.4 + `tailwindcss-animate` |
| Component primitives | Radix + shadcn-style local components in `src/components/ui` |
| Rich text | TipTap 3 (`@tiptap/starter-kit`, `@tiptap/extension-link`) |
| Forms | react-hook-form + zod + react-dropzone |
| CSV | papaparse |
| Auth SDK | `@supabase/ssr` + `@supabase/supabase-js` |
| Data cache | TanStack Query (installed, minimal use) |
| State | Zustand (installed for future) |
| Icons | lucide-react |
| Toasts | Sonner |
| DB | Supabase Postgres 16 |
| Deploy | Vercel |
| Local dev | XAMPP path only for file layout; the app itself is `next dev` |

## Build order

**Phase 1 — DONE.** Everything shipped and running in `ats-webdura.vercel.app`.

- Auth + approval workflow
- Org setup (departments, locations, business units, stages, skills, tags)
- Jobs: create wizard, list, detail (3 tabs), edit, delete, bulk delete
- Candidates: list (5 sub-tabs, sidebar, toolbar), add drawer, detail (7 tabs), edit, delete, bulk delete
- Move-To category (active / talent_pool / archived / duplicate) with audit log
- Resume upload + preview (modal + inline panel) + download via signed URL
- Bulk import/export (streaming, chunked, failure download, resume path mapping)
- Rich-text description editor
- Dashboard with live KPIs + pipeline
- Settings: users (approve/reject/invite), departments, locations, stages, templates
- Vercel deployment + Supabase RLS + storage buckets

**Phase 2** (planned):

- Interview scheduling (with panel, calendar-quality invites even without Google/Outlook sync)
- Resume parsing (Affinda/Rchilli — auto-fills first_name, email, skills)
- Email + WhatsApp messaging per candidate
- Feedback scorecards + templates
- Kanban view per job (drag-drop across stages)
- Reports: source effectiveness, time-to-hire, recruiter productivity

**Phase 3** (later):

- Job board push (LinkedIn / Indeed / Naukri)
- Google + Outlook calendar sync
- Candidate-facing career site + apply form
- AI shortlist scoring
- Offer letter generator + e-sign
- Vendor / agency portal
- Workflow automations (when-X-then-Y)

## Guiding constraints

Non-negotiable technical decisions:

1. **RLS is the source of truth for authorisation.** Never bypass with service-role from client code. The one exception — `SUPABASE_SERVICE_ROLE_KEY` — is used exclusively in `src/lib/supabase/admin.ts` inside server-only invite flows.

2. **Tenant isolation is enforced at Postgres.** The `handle_new_user` trigger writes profiles with the right `tenant_id`; RLS policies gate every read/write. Application code trusts RLS.

3. **Single tenant in production, multi-tenant in schema.** Do not remove `tenant_id` columns to "simplify." A future multi-tenant Webdura Group deployment must not require a schema migration.

4. **Serverless-timeout aware.** Any operation that could take >30s must be chunked client-side or moved to a job runner. Bulk import is the pattern: client parses, chunks, and POSTs 100 rows at a time.

5. **Storage paths embed the tenant.** `<tenant_id>/<candidate_id>/<file>` — this is how bucket policies verify tenant membership. Do not upload to arbitrary paths.

6. **Server components fetch, client components mutate.** Every list page is an async server component. Interactivity (drawers, drop-downs, forms) is client-only, opt-in with `"use client"`.

7. **Candidate is the root entity.** Applications are edges from candidate to job. A candidate can exist without any application (talent pool). Everything category-scoped filters on `candidates.category`, not on any application flag.

8. **Descriptions are stored as HTML** (TipTap output). Reads must go through `RichTextView`, which handles legacy plain-text rows too.

9. **No hard-coded URLs.** `NEXT_PUBLIC_SITE_URL` is used in every redirect that must survive prod vs. local.

10. **No side effects in Server Components at render time** beyond the `Promise.all` read set. Writes go through server actions or route handlers.

### Format tip

An architecture diagram (SVG or draw.io export) placed at `docs/architecture.svg` would be ideal here. Until then, this markdown is the source of truth.
