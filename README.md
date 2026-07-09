# ATS-Webdura

Applicant Tracking System for **Webdura Technologies**. Next.js 15 (App Router) + Supabase (Postgres + Auth + Storage + RLS). Deployed at [ats-webdura.vercel.app](https://ats-webdura.vercel.app).

Phase 1 is live and in daily use. See [SPEC.md](./SPEC.md) for what shipped and what's next.

---

## The six documents

Before touching this repo, read these in order:

| # | File | Answers |
|---|------|---------|
| 1 | [BRIEF.md](./BRIEF.md) | Why does this exist? |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | How is it structured? |
| 3 | [SPEC.md](./SPEC.md) | What exactly gets built? |
| 4 | **README.md** (this file) | How do I run it? |
| 5 | [CLAUDE.md](./CLAUDE.md) | What does the AI agent need to know? |
| 6 | [STATUS.md](./STATUS.md) | Where are we right now? |

---

## Prerequisites

- **Node.js 22 LTS** (managed via `nvm` recommended)
- **npm 10+** (or pnpm / bun — commands below use npm)
- **Git** (obviously)
- **Supabase account** with a linked project. Ours is `rlspryfcbzmthiqbwsyz`.
- **Vercel account** (only if you plan to deploy)
- **Supabase CLI** — installs via `npm install` (it's a devDependency); invoke with `npx supabase`

---

## Setup — from `git clone` to running app

### 1. Clone + install

```bash
git clone <this-repo>
cd ATS-Webdura
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in from **Supabase → Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>       # server-only; never exposed to client
NEXT_PUBLIC_SITE_URL=http://localhost:3000          # or your Vercel URL in prod
```

### 3. Apply Supabase migrations

If you're joining a project that already has the schema deployed, skip to step 4. If you're setting up a fresh Supabase project, run all migrations:

```bash
# Link to your Supabase project
export SUPABASE_ACCESS_TOKEN="sbp_…"   # from https://supabase.com/dashboard/account/tokens
npx supabase link --project-ref <your-ref>

# Push all migrations
npx supabase db push
```

Or paste each file from `supabase/migrations/` into the SQL editor manually.

### 4. Configure Supabase Auth URLs

In **Supabase → Auth → URL Configuration**:

- **Site URL**: your Vercel domain (e.g. `https://ats-webdura.vercel.app`)
- **Redirect URLs** (both):
  - `https://ats-webdura.vercel.app/auth/callback`
  - `https://ats-webdura.vercel.app/auth/callback?next=/reset-password`

Also add `http://localhost:3000/auth/callback` for local dev.

### 5. (Optional) Regenerate typed schema

```bash
npm run db:types
```

Overwrites `src/lib/types/database.ts` with real types generated from the live schema. The placeholder shipped here compiles fine, but the generated file gives full inference on nested selects.

### 6. Run it

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). You'll land on `/login`. If it's a fresh Supabase project, click **"Sign up for an account"** — the first-ever user is automatically made `super_admin` with `status='active'`.

---

## Development commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Production build; must pass green before merging |
| `npm run start` | Serve the production build locally |
| `npm run lint` | `next lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Apply pending Supabase migrations |
| `npm run db:types` | Regenerate `src/lib/types/database.ts` from linked schema |
| `npm run db:reset` | ⚠️ Reset the linked DB (local dev only) |

---

## Deploy

Auto-deploys from `main` to Vercel. To trigger a build manually:

```bash
vercel --prod
```

Before merging to `main` verify `npm run build` completes green locally.

---

## Repo structure

```
├── BRIEF · ARCHITECTURE · SPEC · CLAUDE · STATUS · README (docs — read first)
├── middleware.ts                    (auth-gating for all routes)
├── next.config.ts / tsconfig / tailwind.config.ts
├── public/
│   ├── images/logo.png
│   ├── Resumes/<job>/<candidate>_<email>.pdf   (bulk-import source files)
│   └── candidates-template.csv
├── src/
│   ├── app/
│   │   ├── (auth)/                  (login, signup, forgot, reset)
│   │   ├── (app)/                   (authenticated routes with sidebar shell)
│   │   ├── api/{jobs,candidates}/{import,export,template}
│   │   ├── auth/callback/           (Supabase code exchange)
│   │   ├── globals.css              (design tokens — palette, radius, sidebar)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                      (shadcn-style primitives)
│   │   ├── layout/                  (app-shell, app-sidebar, app-header)
│   │   ├── jobs/                    (card, grid, wizard, edit form, tabs)
│   │   ├── candidates/              (table, sidebar, drawers, detail sub-components)
│   │   └── shared/bulk-actions.tsx  (import dialog with streaming progress)
│   └── lib/
│       ├── supabase/                (client, server, middleware, admin)
│       ├── types/database.ts        (placeholder — regenerate via db:types)
│       ├── csv.ts
│       └── utils.ts
└── supabase/
    ├── config.toml
    └── migrations/                  (12 SQL files in order)
```

Full architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Where to look when …

- **"How do I add a new page?"** → Follow the pattern in `src/app/(app)/dashboard/page.tsx`. Server Component, `async`, fetches via `createClient()` from `@/lib/supabase/server`.
- **"How do I mutate data from a form?"** → Server action file next to the page (e.g. `actions.ts`). Use `revalidatePath()` after writes. See `src/app/(app)/candidates/actions.ts` for examples.
- **"How do I add a new table?"** → New migration file under `supabase/migrations/`. Include `enable row level security` + policies keyed off `current_tenant_id()`. Regenerate types with `npm run db:types`.
- **"How do I bulk operate on candidates?"** → Extend `MoveToMenu` (single + bulk variants) or wire into the `CandidateTable` selection state.
- **"How do I add a new nav item?"** → Edit the `NAV` array in `src/components/layout/app-sidebar.tsx` and create the route under `src/app/(app)/<slug>/page.tsx`.
- **"How do I add a new field to Add Candidate?"** → `src/components/candidates/add-candidate-form.tsx` (form) + column in the `candidates` table (migration).

---

## Troubleshooting

**"infinite recursion detected in policy for relation jobs"** — you added a policy that references another RLS-protected table. Use one of the `SECURITY DEFINER` helpers instead (`is_on_job_team`, `job_in_my_tenant`, `interview_in_my_tenant`). See migration `20260623000010`.

**Signup lands on a blank page** — the DB trigger didn't fire. Check `select * from public.profiles where id = auth.uid()` in the SQL editor.

**Storage upload 403** — path must start with `<your tenant_id>/`. Every upload site already does this.

**Import stuck / times out** — bulk import chunks client-side to 100 rows per request. If a single batch times out, drop `CHUNK_SIZE` in `src/components/shared/bulk-actions.tsx` to 50.

**Invite emails don't arrive** — Supabase built-in SMTP is throttled (3/hour). Wire up Resend/Postmark in **Supabase Auth → Email Templates → SMTP Settings** for production.

**Sidebar doesn't show on mobile** — expected; tap the hamburger in the top-left of the header.
