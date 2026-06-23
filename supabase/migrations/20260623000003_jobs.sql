-- =============================================================================
-- 00003 — Jobs and hiring team
-- =============================================================================

create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  title             text not null,
  slug              text,
  department_id     uuid references public.departments(id) on delete set null,
  business_unit_id  uuid references public.business_units(id) on delete set null,
  location_id       uuid references public.locations(id) on delete set null,
  experience_min    int,
  experience_max    int,
  description       text,
  skills            text[] not null default '{}',
  employment_type   text, -- full_time | part_time | contract | intern
  salary_min        numeric,
  salary_max        numeric,
  salary_currency   text default 'INR',
  openings          int not null default 1,
  hires             int not null default 0,
  priority          boolean not null default false,
  confidential      boolean not null default false,
  status            job_status not null default 'draft',
  visibility        job_visibility not null default 'internal',
  target_close_date date,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_jobs_tenant_status on public.jobs(tenant_id, status);
create index if not exists idx_jobs_tenant_priority on public.jobs(tenant_id, priority);
create index if not exists idx_jobs_tenant_dept on public.jobs(tenant_id, department_id);
create index if not exists idx_jobs_tenant_location on public.jobs(tenant_id, location_id);
create trigger trg_jobs_updated before update on public.jobs for each row execute function public.set_updated_at();

create table if not exists public.job_team (
  job_id      uuid not null references public.jobs(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_on_job text not null check (role_on_job in ('hiring_manager','recruiter','interviewer','approver')),
  created_at  timestamptz not null default now(),
  primary key (job_id, user_id, role_on_job)
);
create index if not exists idx_job_team_user on public.job_team(user_id);

-- Per-job stage override (subset / reordering of tenant stages)
create table if not exists public.job_stage_config (
  job_id    uuid not null references public.jobs(id) on delete cascade,
  stage_id  uuid not null references public.stages(id) on delete cascade,
  "order"   int not null,
  is_active boolean not null default true,
  primary key (job_id, stage_id)
);
