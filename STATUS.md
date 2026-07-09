# STATUS — ATS-Webdura

*Living record of what has been done and what is next. Update after every session.*

**Last updated:** 2026-07-01

---

## Current phase

**Phase 1 — MVP** ✅ **shipped and in production use**

Currently in the **polish + stabilise** window before Phase 2 begins. No new Phase 1 features — only fixes and hardening.

---

## Phase 1 — MVP (Shipped)

Every box below was validated in the browser at least once.

- [x] Project scaffold: Next.js 15 + TS + Tailwind + shadcn primitives
- [x] Supabase client/server helpers + middleware (`@supabase/ssr`)
- [x] 12 migrations applied on the linked Supabase project
- [x] RLS on every business table with security-definer helpers (no recursion)
- [x] Bootstrap-first signup: first user → super_admin, others → pending
- [x] Approval workflow (approve/reject/disable/reactivate) in `/settings/users`
- [x] Admin invite flow via `inviteUserByEmail` → `invited` → `active` on first password set
- [x] App shell: dark sidebar (Dashboard/Jobs/Candidates/Reports/Settings) + slim top header with global search
- [x] Dashboard: 4 KPI cards, hiring pipeline overview, recent activity, upcoming interviews
- [x] Jobs list: grid, filters, priority toggle, status switcher (Active/All/Drafts/Archived/Closed)
- [x] Create Job 4-step wizard with save-as-draft
- [x] Edit Job flat form
- [x] Delete Job (single + bulk with hover-select checkboxes)
- [x] Job detail: 3 URL-driven tabs (Dashboard / Candidates / Description) with stage pills
- [x] Rich-text description editor (TipTap: bold/italic/H2/H3/bullets/ordered/link/undo/redo)
- [x] Candidates list: 5 sub-tabs, left sidebar, toolbar, 13-column table
- [x] Add Candidate right-slide drawer (resume upload to Storage on submit)
- [x] Edit Candidate drawer
- [x] Delete Candidate (single + bulk)
- [x] Candidate detail: header + action bar + 5 summary cards + 7 tabs (Profile/Resume/Documents/Activity/Notes/Feedback/Communication)
- [x] Resume preview modal + inline resume tab (signed URLs; PDF iframe; DOCX via Office viewer; download fallback)
- [x] Notes tab: sticky-note grid, edit + delete own notes
- [x] Activity timeline merging stage moves + notes + documents + interviews
- [x] Move-To category dropdown (Active / Talent Pool / Archived / Duplicate) — row, bulk, and detail-page variants
- [x] Category moves write to `audit_logs`
- [x] Bulk import (jobs + candidates) with streaming NDJSON progress
- [x] Client-side CSV chunking (100 rows/batch) to avoid Vercel timeouts
- [x] Failed-rows CSV download with `failure_reason` column
- [x] Resume file paths in CSV upload from `public/Resumes/` to Supabase Storage during import
- [x] CSV export (respects current filters)
- [x] Settings: Organisation · Users & roles · Departments · Locations · Pipeline stages · Templates
- [x] Loading skeleton on `/candidates`
- [x] Mobile responsiveness: sidebar drawer, table horizontal scroll, drawer full-width < sm
- [x] Palette to spec: `#F8FAFC` body · `#0F172A` sidebar · `#EF4444` primary · `#E2E8F0` border · 12px radius
- [x] Vercel deployment green (`ats-webdura.vercel.app`)
- [x] Six SOP documents (BRIEF / ARCHITECTURE / SPEC / README / CLAUDE / STATUS) written

---

## Phase 1 — Polish backlog

Small items that would improve Phase 1 UX without adding scope. Pick up opportunistically.

- [ ] Regenerate `src/lib/types/database.ts` via `npm run db:types` (currently a placeholder — set `typescript.ignoreBuildErrors=false` after)
- [ ] Add per-tenant logo override on `/settings/organisation` (column exists, UI not wired)
- [ ] Add `/candidates/profile/[candidate_id]` standalone route so Talent Pool candidates with no applications are still clickable
- [ ] Bump notes pastel opacities from `/20` to `/40` (currently faded on light bg)
- [ ] Add server-side deletion of Storage objects when a candidate is deleted (currently the files linger)
- [ ] Add rate limit / dedupe on the resume upload path (Storage `upsert: false` guards it but we could produce a better error)
- [ ] Split password validation into a shared helper — used in signup + reset

---

## Phase 2 — Advanced (outline)

Detail expanded when Phase 2 starts. Rough scope list:

- [ ] Interview scheduling (schedule dialog, ICS email invites, reminder cron)
- [ ] Feedback scorecards + templates
- [ ] Kanban view per job (drag-drop stages)
- [ ] Resume parsing (Affinda) — auto-fill Add Candidate on drop
- [ ] Email inbox — Sendgrid / Postmark outbound; inbound via Message-Id threading
- [ ] WhatsApp integration — WATI
- [ ] Bulk email + bulk stage move
- [ ] Global search — Meilisearch
- [ ] MFA — TOTP
- [ ] Career site (public `/{tenant-slug}`)
- [ ] Reports: funnel by date range, source effectiveness, time-to-hire, recruiter productivity
- [ ] Feature-flag scaffolding (env-based)

---

## Phase 3 — Automation & integrations (outline)

- [ ] Job board push (LinkedIn / Indeed / Naukri)
- [ ] Calendar sync (Google + Outlook)
- [ ] HRIS integration (BambooHR / Zoho / Darwinbox)
- [ ] Slack + Teams notifications
- [ ] Zapier / public webhooks
- [ ] AI ranker + JD generator
- [ ] Offer letter e-sign
- [ ] Workflow automations
- [ ] Vendor / agency portal

---

## Tooling status

| Tool | State | Notes |
|------|-------|-------|
| Node | 22 LTS | via `nvm` |
| npm | 10.9+ | v11 available; not upgraded |
| Next.js | 15.5.19 | Upgraded from 15.1.3 for CVE-2025-29927 |
| Supabase CLI | 2.107+ | Upgraded from 1.226 for `tar` CVEs |
| Supabase link | ✅ linked to project `rlspryfcbzmthiqbwsyz` | Env vars set in `.env.local` and Vercel |
| Vercel deploy | ✅ `ats-webdura.vercel.app` | Auto-deploys from `main` |
| GitHub CLI (`gh`) | not required | Not currently used by scripts |
| RLS policies applied | ✅ | See `supabase/migrations/20260623000006_rls.sql` + fixes in 10, 11, 12 |
| Storage buckets | ✅ `resumes`, `documents`, `avatars` created | Tenant-prefixed path policies enforced |
| Email provider | ⚠️ Supabase default SMTP (rate-limited) | Switch to Resend/Postmark before scaling invites |

**Re-verify at session start** by running the checklist in [CLAUDE.md](./CLAUDE.md#session-startup-checklist).

---

## Decisions log

Chronological. Add a row every time a non-obvious call is made.

| Decision | Rationale |
|----------|-----------|
| Next.js 15 App Router over 14 / Pages Router | Server Actions + Server Components are core to how the app fetches + mutates. Also matches Webdura platform strategy. |
| Supabase over Firebase / raw Postgres + Auth0 | Free tier is generous, `@supabase/ssr` integrates with Next 15 cleanly, RLS is first-class. |
| Multi-tenant schema for a single-tenant product | Future-proofs the platform for hypothetical Webdura Group deployment without a schema migration. Cost is one extra column per table + RLS policies. |
| Approval-based signup instead of open signup | Product is only for Webdura employees. Approval gate prevents random strangers from landing in an admin dashboard. |
| Bootstrap-first (no admin seeding) | Zero-config onboarding — the first person to hit `/signup` becomes the admin. Simpler than an out-of-band admin creation step. |
| `candidates.category` enum column instead of separate booleans | Categories (active/talent_pool/archived/duplicate) are mutually exclusive. A single column enforces that and simplifies queries. |
| Store descriptions as HTML (from TipTap), render with `RichTextView` | Rich text lists (bullets/numbered) are a hard product requirement for job descriptions. Markdown was considered but TipTap's WYSIWYG matches user expectations better. |
| Client-side CSV chunking (100 rows/batch) instead of a background job queue | No queue infra in Phase 1. Serverless timeouts (60s Hobby / 300s Pro) would kill a monolithic import. Client chunking is enough at Webdura scale (~5k candidates). |
| NDJSON stream over WebSockets for import progress | No persistent connection needed, plays well with serverless, easier to reason about. |
| Palette #EF4444 (red-500) instead of Webdura #E94B35 | User explicitly requested this in the enterprise-ATS design brief. Close enough visually to the brand. |
| Dark sidebar + light body (not full dark theme, not full light) | Matches the modern SaaS pattern (Linear, Ashby). Fits both branding and readability. |
| RLS `SECURITY DEFINER` helpers (`is_on_job_team`, `job_in_my_tenant`) | Cross-table policies between `jobs` and `job_team` create infinite recursion in Postgres. Definer functions break the loop. |
| Vercel `maxDuration = 300` on import routes | Gives Pro-tier headroom without changing hobby behaviour. Combined with client chunking, imports of any size complete. |
| RichTextView fallback for legacy plain text | Existing job descriptions are plain text. Detect HTML via regex; if none, wrap in `<p>` with preserved line breaks. Avoids a data migration. |
| Six SOP docs (BRIEF/ARCHITECTURE/SPEC/README/CLAUDE/STATUS) at project root | Per team SOP under `/AI_Opportunity/`. Enables cold-session agentic work + zero-meeting developer onboarding. |

---

## Blockers

None as of 2026-07-01.

*(Format: what is stuck · why · owner · unblocker.)*

---

## Notes for the next session

- All six SOP documents are in place. Update [STATUS.md](./STATUS.md) after every working session — check off items, add decisions, log blockers.
- If any auth / schema / storage-path convention changes, update [CLAUDE.md](./CLAUDE.md) the same day. Stale agent context is worse than none.
- The next major decision: when to start **Phase 2** and which item to lead with. Two strong candidates: (a) interview scheduling — highest recruiter pain; (b) resume parsing — biggest time saver on data entry.
