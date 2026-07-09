# SPEC — ATS-Webdura

> **Answers:** *What exactly gets built — screen by screen, flow by flow?*

Group by phase. Phase 1 (shipped) is documented in full; Phases 2–3 in outline. Expand outlines as those phases become current.

---

## Phase 1 — MVP (Shipped)

**Goal:** Webdura's HR team can post jobs, add candidates (manually or by bulk CSV import with resumes), move them through pipeline stages, and manage user access — all in a single dark-sidebar app that replaces spreadsheets + shared drive.

### Screens

#### `/login`
- Fields: email, password. `Forgot?` link → `/forgot-password`.
- Shows a coloured banner if `?status=pending|rejected|disabled` or `?signup=pending` is present.
- On success, redirects to `/dashboard`; on non-active status, signs out and redirects back to `/login?status=…`.
- Role: unauthenticated only. Authenticated users are redirected to `/dashboard`.

#### `/signup`
- Fields: first_name, last_name, email, password.
- Info banner: "An administrator will approve your request before you can sign in."
- On submit, the DB trigger creates a `profiles` row with status = `pending` (or `active` if this is the first-ever user). Client is signed out and redirected to `/login?signup=pending`.

#### `/forgot-password`, `/reset-password`
- Standard Supabase password reset. `?invited=1` variant on reset-password shows "Welcome — set your password" copy and auto-promotes the user's status from `invited` → `active` on submit.

#### `/dashboard`
- Header: "Welcome back" + subtitle.
- 4 KPI cards (icon + value + hover state): Active jobs · Candidates · Upcoming interviews · Hired this month.
- Hiring pipeline overview: one tile per stage with count across all active jobs.
- Two-column row: Recent activity (stage-move history with avatars + from→to badges) · My pending tasks (empty state — Phase 2).
- Upcoming interviews list: next 5 scheduled with avatar, candidate, job, date, mode badge.

#### `/jobs`
- Filter bar chips: Status · Business Unit · Department · Hiring Manager · Recruiter · Location · Search.
- Priority toggle switch.
- Grid/List view toggle (grid only for now).
- Status switcher (`Active` / `All` / `Drafts` / `Archived` / `Closed`) on the title.
- **Import** / **Export** / **+ Create Job** buttons.
- Cards show: title, department + location, priority dot, confidentiality lock, candidate count, hires/openings ratio, target date, assigned recruiter avatar, status badge (CONFIDENTIAL/ONLINE/OFFLINE), footer with new + archived candidate counts.
- Hover reveals a checkbox on each card; multi-select → floating bulk delete bar at bottom.

#### `/jobs/new`
Full-screen wizard, 4 steps, save-draft at every step:
1. **Job Description** — title *, department *, experience range, description (TipTap rich text with bullets/numbered/headings/links/undo/redo), skills chips.
2. **Job Details** — employment type, location, business unit, salary min/max/currency, openings, priority switch, confidential switch, target close date.
3. **Hiring Team (Optional)** — Recruiters, Hiring Managers, Interviewers (checkbox lists from active profiles).
4. **Publish Options** — Internal only / Career site / External boards radio.

#### `/jobs/[id]`
Tabbed detail (URL-driven, `?tab=dashboard|candidates|description`):
- **Header**: department label, title, CONFIDENTIAL/PRIORITY badges, meta strip (employment type, location, hires/openings, target close), Edit + Delete buttons.
- **Dashboard tab**: 4 KPIs (Upcoming interviews · Days open · Total candidates · Closed/Total positions with "N days exceeded" if past target), pipeline tile row, description preview (plain-text extract), hiring team panel.
- **Candidates tab**: stage-count pills at top (each links to `?stage=<id>`), scoped candidate table.
- **Job Description tab**: full description (HTML rendered), skills chips, Edit button; right rail with Location · Job type · Department · Business unit · Experience · Salary · Positions · Visibility · Target close · Created.

#### `/jobs/[id]/edit`
Flat single-page form (not a wizard). Same fields as create wizard plus Status + Visibility select. Save returns to `/jobs/[id]`.

#### `/candidates`
Left sidebar (256px, hidden below `md`):
- My candidates · Upcoming interviews · Pending feedback (each with count pill and active-state highlight).
- Your active jobs — searchable list, click to filter (`?job=<id>`), count per job.

Header row: title + count pill, subtitle explaining the view, **Import** / **Export** / **+ Add Candidate**.

Sub-tabs (light theme, urgent-underlined): My Candidates · All Candidates · Talent Pool · Archived · Duplicates.

Toolbar (white card): Stage · Source · Tags dropdowns · search input · More filters · Archive · Download.

Table: 13 columns — checkbox · candidate (avatar+name, tinted by hash) · job title · stage (colour-coded badge) · category (Active/Talent Pool/Archived/Duplicate) · exp · updated · source · applied · previous co. · preferred loc. · contact (phone+email) · actions (Move-To icon).

Selection → floating pill at bottom: `N selected · Move to… · Delete`.

#### `/candidates/[id]` (application id in URL)
- **Header card**: avatar, name, current company as designation, contact strip (email/phone/location), experience, applied/updated dates, stage colour-coded badge, source + owner + inline stage switcher.
- **Action bar**: category badge · Edit · Preview resume · Download · Schedule (P2 stub) · Email (mailto) · Add note · Move To dropdown · overflow (Delete).
- **5 summary cards**: Hiring stage · Applied jobs · Interviews · Notes · Last activity.
- **7 tabs** (client shell):
  1. **Profile** — 7 sub-cards (Personal · Professional · Skills · Work experience · Education · Certifications · Social links).
  2. **Resume** — inline preview panel (PDF iframe, DOCX via Office viewer, download fallback). Upload zone if no resume.
  3. **Documents** — list of all attached files.
  4. **Activity** — timeline merging candidate created + stage moves + notes + document uploads + interviews.
  5. **Notes** — sticky-note grid, composer (⌘/Ctrl+Enter to post), edit + delete own notes.
  6. **Feedback** — placeholder (Phase 2).
  7. **Communication** — placeholder (Phase 2).

#### Add Candidate drawer (right slide-over)
- Job (dropdown, required)
- Resume drag-drop (≤10 MB)
- First / Middle / Last name (First required)
- Mobile with country code, Email
- Stage (default Sourced), Source, Candidate owner
- Gender, Date of birth
- Current salary (currency + amount + NA), Expected salary (same), Experience (years + months), Available to join (days)
- Preferred / Current location
- Skills chip input
- Additional documents (≤5 MB)

#### Edit Candidate drawer
Same fields as Add drawer, prefilled, minus job/resume/skills (those are edited elsewhere).

#### `/reports`
Placeholder — one card per active job showing candidate count + hires ratio. Phase 2 adds funnel by date range, source effectiveness, time-to-hire.

#### `/settings`
Card grid linking to sub-pages: Organisation · Users & roles · Departments · Locations · Pipeline stages · Templates.

#### `/settings/users`
- Filter chips with counts: All · Pending · Active · Invited · Disabled · Rejected.
- Success/error banner from invite action query params.
- Invite form (admin-only): email * · first_name · last_name · role select.
- Table: Member · Email · Role (inline change dropdown) · Status badge · Joined · Last sign-in · Actions.
- Contextual actions per status:
  - `pending` → Approve · Reject
  - `invited` → Resend · Cancel
  - `active` → Disable
  - `disabled` → Reactivate
  - `rejected` → Approve (restore)
  - self row → read-only

#### `/settings/{organisation, departments, locations, stages, templates}`
Standard CRUD sub-pages: header + description, form for create/edit, list with archive/restore actions. Stages have colour + order + terminal flag.

### User flows

#### Register → get approved → sign in
1. New user opens `/signup`, fills form, submits.
2. `handle_new_user` DB trigger creates `profiles` row with `status='pending'` in the sole existing tenant.
3. Client is auto-signed-in by Supabase, but `signupAction` immediately signs them out on detecting `status !== 'active'` and redirects to `/login?signup=pending`.
4. Admin sees the new user under `Settings → Users & roles → Pending`.
5. Admin clicks Approve → `approveUser` server action sets `status='active'` + writes an `audit_logs` row.
6. User signs in normally → `loginAction` sees `status='active'` → allowed → `/dashboard`.

#### Add candidate → move through pipeline
1. Recruiter opens `/candidates`, clicks **+ Add Candidate**.
2. Fills the drawer, uploads resume, selects a job. Submit.
3. Server action creates `candidates` row (owner = current user, `category='active'`), uploads resume to Storage `resumes/<tenant>/<candidate>/<file>`, inserts `documents` row of `kind='resume'`, creates `applications` row linking to job with `current_stage_id = Sourced`.
4. Recruiter opens candidate detail → clicks the stage chip → picks a new stage in the modal → adds an optional comment → confirms.
5. Server RPC `move_application_stage(app, stage, comment)` updates `applications.current_stage_id` and inserts `application_stage_history` row atomically.
6. Dashboard's Recent Activity picks up the move on the next render.

#### Bulk import candidates with resumes
1. Recruiter downloads CSV template from the Import dialog.
2. Fills rows including a `Resume` column with paths under `public/Resumes/`.
3. Uploads. Client parses CSV, splits into batches of 100 rows.
4. For each batch, POSTs to `/api/candidates/import` and reads streamed NDJSON events.
5. UI shows: `Batch 3 of 35 · 287 / 3411 (8%)` + current candidate name; failed rows accumulate in an amber panel.
6. On done: green success card + Download failed rows button. Failed CSV has original columns + `failure_reason` for correction and re-upload.

#### Admin invites a user
1. Admin fills the Invite form in Settings → Users & roles.
2. `inviteUser` server action calls `admin.auth.admin.inviteUserByEmail()` with metadata `{ invited_by_admin: true, tenant_id: <inviter's>, role }`.
3. DB trigger creates `profiles` with `status='invited'`, right tenant, right role.
4. Supabase sends invite email with a link that lands on `/auth/callback?code=…&next=/reset-password`.
5. Callback exchanges the code (user is now authenticated) and detects `status='invited'` → redirects to `/reset-password?invited=1`.
6. User sets password → action promotes `status='active'` and stamps `last_login_at` → redirects to `/dashboard`.

### Acceptance criteria — Phase 1

Binary checklist. Every item must pass for Phase 1 to be considered done. All currently pass.

- [x] Bootstrap flow: `/signup` on a fresh install creates a `super_admin` with `status='active'` and lands on `/dashboard`.
- [x] Subsequent `/signup` produces `status='pending'`; login is blocked with the "awaiting approval" banner.
- [x] Admin can approve/reject/disable/reactivate from `/settings/users` and status updates are enforced on the next request.
- [x] Admin can invite a user by email; invitee sets password via `/reset-password?invited=1` and lands active in `/dashboard`.
- [x] Jobs create wizard saves as draft at every step; publishing an active job makes it visible on `/jobs`.
- [x] Job detail's 3 tabs are URL-driven; deep-linking `?tab=candidates&stage=<id>` filters the candidate table.
- [x] Bulk delete on the jobs grid and candidates table both work behind a confirm dialog.
- [x] Move-To categoriser works from row action, bulk bar, and detail action bar. Every move writes to `audit_logs`.
- [x] Candidate detail resume tab embeds a PDF preview via signed URL; DOC/DOCX renders through Office viewer.
- [x] CSV bulk import of 3,000+ rows completes without timeout via client-side chunking; failed rows exportable with reason column.
- [x] Resume paths under `public/Resumes/` map to Supabase Storage during import and appear on the candidate's Resume tab.
- [x] Rich-text job descriptions round-trip (bullets, headings, links survive save + reload).
- [x] `middleware.ts` redirects unauth users to `/login`; auth users away from `/login`.
- [x] RLS blocks reads across tenants (verifiable via SQL editor).
- [x] Every page renders on 375px mobile without horizontal scroll; sidebar collapses to a drawer.
- [x] `npm run build` completes green on every commit.

### Out of scope for Phase 1

Explicitly deferred:
- Interview scheduling with panel + reminders
- Calendar sync (Google / Outlook)
- Automated resume parsing
- Email / WhatsApp two-way threads
- Scorecards + feedback templates
- Kanban view per job
- Job board syndication
- Candidate-facing career site
- Vendor / agency portal
- Workflow automations
- Offer letter generation + e-sign
- MFA / TOTP
- Native mobile app
- Multi-tenant onboarding UI

### API contracts (internal)

**`POST /api/candidates/import`** — streams `application/x-ndjson`. Events:
```jsonl
{"type":"start","total":100}
{"type":"row","index":0,"name":"Alfina L","status":"ok","resume":"uploaded"}
{"type":"row","index":1,"name":"Karanjit","status":"skip","reason":"no matching job for \"Jr Copy Writer Intern\""}
{"type":"done","total":100,"inserted":95,"skipped":5,"resumes_uploaded":78,"failures":[…]}
```
Request body: `multipart/form-data` with a `file` field (CSV) and optional `job_id` for the fallback job assignment.

**`POST /api/jobs/import`** — same event shape, no resume field.

**`GET /api/{candidates,jobs}/export`** — returns `text/csv` with a `Content-Disposition: attachment; filename=…-YYYY-MM-DD.csv` header. Query params filter (e.g. `?view=archived`, `?status=active`).

**`GET /api/{candidates,jobs}/template`** — returns `text/csv` with example rows.

**`POST /auth/callback?code=…&next=…`** — Supabase code-exchange endpoint. `next=/reset-password` routes invited users through the password-setup flow.

### Non-functional requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | Time-to-interactive on `/candidates` (server-rendered) | < 1.5s on 4G |
| NFR-2 | Bulk import for 3,500 candidates with resumes | Completes within 20 min, no timeouts |
| NFR-3 | Every write action logs to `audit_logs` with actor + before/after | Yes |
| NFR-4 | RLS enforced on every business table | Yes |
| NFR-5 | Responsive from 375px mobile up to 4K desktop | Yes |
| NFR-6 | No hardcoded secrets in source | Yes — `.env` only |
| NFR-7 | Vercel build completes green on every push to `main` | Yes |
| NFR-8 | Supabase storage buckets require tenant-prefixed paths | Yes — RLS on storage.objects |
| NFR-9 | All destructive actions gated by confirm dialog | Yes |
| NFR-10 | All lists paginate or cap safely (500-row limit on candidates, 200 on notes) | Yes |

### Open questions

- [ ] [CONFIRM] Should Rejected users be soft-deleted after N days, or kept forever for audit? Currently kept forever. Consider retention policy.
- [ ] [CONFIRM] Interview scheduling in Phase 2 — do we need Google/Outlook two-way sync from day one, or is a simple in-app calendar + ICS attachment enough?
- [ ] [CONFIRM] Resume parsing (Phase 2) — Affinda vs Rchilli vs self-hosted (Tika + NLP). Cost / accuracy tradeoff pending.

---

## Phase 2 — Advanced (Outline)

Detailed spec when Phase 2 starts. Rough scope:

- **Interview scheduling** — schedule dialog (mode, date/time, panel), ICS attachments, email invites, reminder cron.
- **Feedback scorecards** — per-stage templates, rating axes, weighted decision aggregation.
- **Kanban view** — drag-drop board per job as an alternative to the pipeline pill row.
- **Email inbox** — SendGrid or Postmark for outbound; inbound via Message-Id threading.
- **WhatsApp integration** — WATI or Twilio.
- **Bulk actions** — bulk email, bulk stage move.
- **Resume parsing** — Affinda API; auto-populate Add Candidate form on resume drop.
- **Global search** — Meilisearch across candidates + jobs.
- **MFA** — TOTP.
- **Career site** — public `/{tenant-slug}` pages, apply form, custom subdomain.
- **Reports** — funnel by date range, source effectiveness, time-to-hire, recruiter productivity.

## Phase 3 — Automation & Integrations (Outline)

- Job board push (LinkedIn / Indeed / Naukri)
- Google + Outlook calendar sync
- HRIS integrations (BambooHR / Zoho People / Darwinbox)
- Slack + Teams notifications
- Zapier / webhooks
- AI candidate ranking + JD generator
- Offer letter e-sign (DocuSign / SignDesk)
- Workflow automations (when-X-then-Y builder)
- Vendor / agency portal
- Custom domain career sites
