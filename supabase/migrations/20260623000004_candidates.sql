-- =============================================================================
-- 00004 — Candidates, applications, stage history, related data
-- =============================================================================

create table if not exists public.candidates (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  first_name             text not null,
  middle_name            text,
  last_name              text,
  email                  citext,
  phone                  text,
  gender                 text,
  date_of_birth          date,
  current_location       text,
  preferred_location     text,
  current_company        text,
  current_salary         numeric,
  current_salary_currency text default 'INR',
  expected_salary        numeric,
  expected_salary_currency text default 'INR',
  experience_years       int default 0,
  experience_months      int default 0,
  notice_period_days     int,
  linkedin_url           text,
  github_url             text,
  portfolio_url          text,
  source                 text, -- linkedin | indeed | referral | naukri | career_site | manual | ...
  owner_id               uuid references public.profiles(id) on delete set null,
  is_archived            boolean not null default false,
  archive_reason         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_candidates_tenant on public.candidates(tenant_id);
create index if not exists idx_candidates_tenant_email on public.candidates(tenant_id, email);
create index if not exists idx_candidates_tenant_phone on public.candidates(tenant_id, phone);
create index if not exists idx_candidates_tenant_owner on public.candidates(tenant_id, owner_id);
create index if not exists idx_candidates_search on public.candidates using gin (
  to_tsvector('simple', coalesce(first_name,'')||' '||coalesce(last_name,'')||' '||coalesce(email::text,'')||' '||coalesce(phone,''))
);
create trigger trg_candidates_updated before update on public.candidates for each row execute function public.set_updated_at();

create table if not exists public.candidate_experiences (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  company       text,
  title         text,
  start_date    date,
  end_date      date,
  is_current    boolean not null default false,
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cand_exp_cand on public.candidate_experiences(candidate_id);

create table if not exists public.candidate_educations (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  institution   text,
  degree        text,
  field         text,
  start_year    int,
  end_year      int,
  grade         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cand_edu_cand on public.candidate_educations(candidate_id);

create table if not exists public.candidate_skills (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  skill_id     uuid not null references public.skills(id) on delete cascade,
  primary key (candidate_id, skill_id)
);

create table if not exists public.candidate_tags (
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  tag_id       uuid not null references public.tags(id) on delete cascade,
  primary key (candidate_id, tag_id)
);

-- ---------- APPLICATIONS (candidate ↔ job, with pipeline state) ----------
create table if not exists public.applications (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  candidate_id       uuid not null references public.candidates(id) on delete cascade,
  job_id             uuid not null references public.jobs(id) on delete cascade,
  current_stage_id   uuid references public.stages(id) on delete set null,
  overall_decision   application_decision not null default 'pending',
  applied_via        text default 'manual',
  applied_at         timestamptz not null default now(),
  is_archived        boolean not null default false,
  archive_reason     text,
  created_by         uuid references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now(),
  unique (candidate_id, job_id)
);
create index if not exists idx_applications_tenant_job on public.applications(tenant_id, job_id);
create index if not exists idx_applications_tenant_stage on public.applications(tenant_id, current_stage_id);
create index if not exists idx_applications_tenant_candidate on public.applications(tenant_id, candidate_id);
create trigger trg_applications_updated before update on public.applications for each row execute function public.set_updated_at();

create table if not exists public.application_stage_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage_id  uuid references public.stages(id) on delete set null,
  to_stage_id    uuid not null references public.stages(id) on delete cascade,
  moved_by       uuid references public.profiles(id) on delete set null,
  comment        text,
  moved_at       timestamptz not null default now()
);
create index if not exists idx_stage_history_app on public.application_stage_history(application_id, moved_at desc);
