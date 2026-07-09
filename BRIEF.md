# BRIEF — ATS-Webdura

> **Answers:** *Why does this exist, and for whom?*

---

## The problem

Recruiting at Webdura Technologies runs on spreadsheets, email threads, ad-hoc calendar invites, and a shared Google Drive folder for resumes. This causes:

- **Duplicate candidate profiles** — the same applicant is sourced from LinkedIn *and* Indeed and lands in different rows with different notes.
- **Lost resumes** — files live across recruiters' inboxes; the hiring manager can't find the latest one.
- **No shared pipeline** — nobody outside the recruiter knows which candidate is at which stage for a given role.
- **Missed follow-ups** — feedback rounds are chased manually over WhatsApp; some interviewers never respond.
- **No history** — when a candidate re-applies six months later, we have no record of what happened last time.

The friction costs Webdura roughly one full recruiter-day per week in coordination and duplicate work, plus occasional lost hires because a good candidate went cold.

## Who it is for

**Primary users**
- **HR Team (Recruiters)** — daily driver. Sources candidates, moves them through stages, chases feedback, schedules interviews.
- **Hiring Managers** — reviews candidates for their own reqs, submits feedback, approves offers.

**Secondary users**
- **Interviewers** — reads a candidate's profile before the call, submits a scorecard after.
- **Department Heads** — read-only view of their department's pipeline for headcount planning.
- **Admins / HR Head** — org config, user approvals, reports.

Everyone in the room is a Webdura employee. No candidate-facing UI in Phase 1 beyond the invitation email flow.

## What it does

A single web application at **[ats-webdura.vercel.app](https://ats-webdura.vercel.app)** that replaces the spreadsheet + drive + calendar-invite jumble with:

- A **job requisition** system (post → source → shortlist → hire).
- A **candidate pipeline** with configurable stages and stage-move history.
- A **resume vault** — PDFs / DOCX stored per candidate, previewable inline.
- **Bulk import** for onboarding existing candidate lists (with resume file mapping).
- An **approval-based user workflow** so only vetted Webdura employees see live data.
- **Category management** — active, talent pool, archived, duplicate — so the same table serves current pipelines *and* long-term candidate memory.

It connects to Supabase (Postgres + Auth + Storage) as its backing store. It does not send emails, sync calendars, or push to external job boards in Phase 1.

## The differentiating insight

Almost every off-the-shelf ATS (Greenhouse, Lever, Workable) is designed for high-volume recruiting agencies. Webdura is a mid-size services company with **specific, opinionated recruiter workflows** — batch import from mixed sources, resume paths that reflect internal folder structure, approval-gated access because we don't hand recruiter dashboards to random signups. An in-house build lets us tune the pipeline to how Webdura actually recruits, without paying per-seat SaaS fees or having features we don't need get in the way.

## What it is not

Explicitly out of scope for Phase 1:

- **External job board syndication** (LinkedIn, Indeed, Naukri push) — Phase 3.
- **Automated resume parsing** (Affinda/Rchilli) — Phase 2.
- **Two-way email / WhatsApp threads** — Phase 2.
- **Calendar sync** (Google, Outlook) with interviewer availability — Phase 2.
- **Candidate-facing portal** (self-serve application status page) — Phase 3.
- **AI resume screening** / auto-shortlist scoring — Phase 3.
- **Custom pipeline workflow builder** (drag-drop stage automations) — Phase 3.
- **Offer letter generation + e-sign** — Phase 3.
- **Native mobile app** — never planned; responsive web is the mobile experience.
- **Multi-organisation SaaS marketing** — the platform is *architecturally* multi-tenant but the product is not marketed to third parties.

## Success metrics

Objectively measurable:

1. **Adoption**: Webdura's HR team uses ATS-Webdura for 100% of new requisitions within 60 days of go-live. Old spreadsheet abandoned.
2. **First hire through the system**: at least one candidate reaches `Hired` stage entirely via the app within the first month.
3. **Import success**: existing candidate backlog (~3,400 rows) imports without data loss.
4. **Time-to-shortlist**: from "candidate added" to "candidate reaches Interview stage" drops by 30% vs the pre-ATS baseline.
5. **Zero-loss handoff**: when a recruiter is on leave, another recruiter can pick up a candidate mid-pipeline and see everything (stage history, notes, resume) without a briefing.

## Constraints

- **Budget**: no per-seat SaaS. Infra costs must fit Supabase Free/Pro + Vercel Hobby/Pro tier.
- **Team**: one full-stack engineer (agent-assisted).
- **Timeline**: Phase 1 (this repo, current state) shipped and in daily use. Phases 2–3 opportunistic.
- **Data residency**: single Supabase project (ap-south-1 preferred for latency to the Kalamassery office).
- **Tech**: Next.js + Supabase — team's preferred stack, aligns with the Webdura platform strategy under `/AI_Opportunity/`.
- **Non-negotiable decisions**:
  - **Row-Level Security is mandatory** — every table gates writes by `tenant_id`. No service-role clients in browser code.
  - **Bootstrap-first onboarding** — the very first user of a fresh install becomes super_admin. All subsequent signups are pending approval.
  - **Candidate is the root entity**, not the application. A candidate can appear on many jobs.
