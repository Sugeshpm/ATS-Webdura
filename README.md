# Hiring Tracker

A multi-tenant Applicant Tracking System (ATS) built on **Next.js 15 (App Router)** + **Supabase** (Postgres + Auth + Storage + RLS).

This repo is the Phase-1 MVP scaffold. See [../IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for the full SRS, ER, roadmap, and screen-by-screen feature spec.

---

## Quick start

### 1. Install dependencies

```powershell
# from E:\HRM\app
npm install     # or: pnpm install / bun install / yarn
```

### 2. Configure environment

Copy the env example and paste your Supabase project keys:

```powershell
copy .env.local.example .env.local
```

Open `.env.local` and fill in from **Supabase → Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>        # server-only, do not expose
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Apply migrations

Install the Supabase CLI if you haven't:

```powershell
npm i -g supabase
```

Link to your existing cloud project (replace `<project-ref>`):

```powershell
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

This runs the SQL in `supabase/migrations/` in order:

1. `…_init.sql`          — tenants, profiles, enums, signup trigger
2. `…_org_setup.sql`     — departments, business units, locations, stages, skills, tags + default-stage seeder
3. `…_jobs.sql`          — jobs, job_team, job_stage_config
4. `…_candidates.sql`    — candidates, experiences, educations, skills, tags, applications, stage history
5. `…_interactions.sql`  — interviews, panel, feedback, messages, notes, documents, notifications, audit
6. `…_rls.sql`           — Row Level Security for all tables (multi-tenant isolation)
7. `…_storage.sql`       — `resumes`, `documents`, `avatars` buckets + policies
8. `…_views.sql`         — `v_jobs_with_counts` view, `move_application_stage` RPC, `job_funnel` RPC

> All app reads/writes go through **the anon key + RLS**, so a session JWT is enough — no admin/service role on the client.

### 4. Generate database TypeScript types

```powershell
npm run db:types
```

This overwrites `src/lib/types/database.ts` with types matching your live schema. The placeholder we shipped is good enough to compile, but the generated file is the source of truth.

### 5. Run the app

```powershell
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Click **Create an organisation** to register; the DB trigger spins up a tenant + admin profile for you.

---

## What's wired in this scaffold

| Area | State |
|------|-------|
| Auth (email + password) via Supabase Auth | ✅ login, signup, forgot, reset, OAuth callback route |
| Multi-tenant signup (creates tenant + admin profile via DB trigger) | ✅ |
| RLS — every table isolated by `current_tenant_id()` | ✅ |
| Confidential-job visibility (admins + assigned team only) | ✅ |
| Dashboard with live KPI tiles | ✅ |
| Active Jobs grid (matches Screenshot 1) | ✅ |
| Create Job 4-step wizard (Description → Details → Team → Publish) | ✅ |
| Candidates list with sub-tabs, sidebar, filter bar, table | ✅ |
| Add Candidate side panel with resume upload to Storage | ✅ |
| Candidate detail with stage-move RPC, notes rail, tabs | ✅ |
| Job detail with stage-funnel via `job_funnel()` RPC | ✅ |
| Stubs for Messages / Preboarding / Career Site / Apps | ✅ (link target, content in Phase 2) |
| Settings shell | ✅ (sub-pages coming) |

## Roadmap (next)

- Resume parsing (Affinda / Rchilli) to autofill the Add Candidate form
- Interview scheduling with Google/Outlook two-way sync
- Email + WhatsApp messaging in candidate detail
- Per-job kanban view + bulk actions
- Feedback templates & scorecards
- Public career site under `app/(public)/[tenantSlug]/...`
- Reports: funnel by date range, source effectiveness, time-to-hire
- Settings sub-pages: Users & roles, Departments, Locations, Stages, Templates

See the full module table in [../IMPLEMENTATION_PLAN.md §4 and §9](../IMPLEMENTATION_PLAN.md).

---

## Project layout

```
app/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/           login, signup, forgot, reset
│  │  ├─ (app)/            authenticated routes (dashboard, jobs, candidates, ...)
│  │  ├─ auth/callback/    OAuth/PKCE callback
│  │  ├─ globals.css
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ ui/               shadcn-style primitives
│  │  ├─ layout/           org header, top nav
│  │  ├─ jobs/             job card, filter bar, create wizard
│  │  └─ candidates/       sidebar, table, drawer, stage-move menu, notes rail
│  ├─ lib/
│  │  ├─ supabase/         client.ts, server.ts, middleware.ts
│  │  ├─ types/            database.ts (generated)
│  │  └─ utils.ts
│  └─ hooks/
├─ supabase/
│  ├─ config.toml
│  └─ migrations/          *.sql in order
├─ middleware.ts           routes auth-gating
├─ next.config.ts
├─ tailwind.config.ts
├─ package.json
└─ .env.local              (gitignored; copy from .env.local.example)
```

## Tech choices

- **Next.js 15 App Router** — server components for data fetching, server actions for forms
- **TypeScript strict**
- **TailwindCSS + shadcn-style primitives** — dark theme matching the reference product
- **Supabase JS v2 + @supabase/ssr** — cookie-based session, works in middleware/RSC/client
- **TanStack React Query** (installed, not yet used) — for client mutations & cache
- **React Hook Form + Zod** (installed) — for richer forms
- **Sonner** — toast notifications
- **lucide-react** — icons

## Conventions

- **Server-first**: data fetching lives in RSC pages (`page.tsx`); client components are leaves (forms, popovers, menus)
- **No client-side Supabase admin calls** — all writes go through the user's session and respect RLS
- **Tenant isolation** is enforced by RLS — `current_tenant_id()` is derived from `auth.uid()` → `profiles.tenant_id`
- **Storage paths** follow `<tenant_id>/<candidate_id>/<filename>` so bucket policies can extract tenant from path

## Troubleshooting

- *"infinite recursion detected in policy"* — usually means a policy queries a table that gates back on itself. Use `security definer` helpers (we use `current_tenant_id()`, `is_admin()`).
- *Signup works but app shows blank screen* — confirm the `handle_new_user` trigger fired by checking `select * from public.profiles` in Supabase SQL editor. Make sure the `auth → email` setting has `enable_signup = true`.
- *RLS denies your own row* — the JWT may not yet have a profile. The signup trigger creates one synchronously, but if you created the auth user via the Supabase dashboard you must `insert into public.profiles` manually with the right `tenant_id`.
- *Resume upload 403* — bucket policies require the path to start with `<your tenant_id>/`. The Add Candidate form already does this; double-check if you're uploading manually.
