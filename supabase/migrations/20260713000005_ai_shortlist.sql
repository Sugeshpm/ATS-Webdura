-- =============================================================================
-- 00018 — AI Shortlisting
--
-- Adds:
--   * ai_evaluations       — immutable audit log (one row per evaluation, incl. cost)
--   * ai_settings          — per-tenant toggle, threshold, monthly cost cap
--   * applications.ai_*    — denormalized "latest state" for fast filter/sort
-- =============================================================================

create table if not exists public.ai_evaluations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  job_id         uuid not null references public.jobs(id) on delete cascade,
  document_id    uuid references public.documents(id) on delete set null,

  -- Scoring output
  score          int not null check (score between 0 and 100),
  verdict        text not null,                    -- 'shortlisted' | 'borderline' | 'not_shortlisted' | 'no_resume' | 'error'
  summary        text,
  strengths      text[] not null default '{}',
  gaps           text[] not null default '{}',

  -- Provenance / cost
  model          text not null,                    -- e.g. 'claude-haiku-4-5-20251001'
  prompt_version text not null default 'v1',
  input_tokens   int,
  output_tokens  int,
  cost_usd       numeric(10, 4),
  error          text,

  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id) on delete set null
);
create index if not exists idx_ai_eval_app on public.ai_evaluations(application_id, created_at desc);
create index if not exists idx_ai_eval_tenant_score on public.ai_evaluations(tenant_id, score desc);
create index if not exists idx_ai_eval_tenant_created on public.ai_evaluations(tenant_id, created_at desc);

alter table public.ai_evaluations enable row level security;
create policy "ai_eval_read_own_tenant"
  on public.ai_evaluations for select
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));
-- Writes go through server-side routes using the service role; keep insert path
-- open to authenticated users of the same tenant for backup / diagnostics use.
create policy "ai_eval_write_own_tenant"
  on public.ai_evaluations for insert
  with check (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));

-- ---------- Denormalized state on applications ----------
alter table public.applications add column if not exists ai_status text;
alter table public.applications add column if not exists ai_score int;
alter table public.applications add column if not exists ai_evaluated_at timestamptz;
create index if not exists idx_applications_ai_status on public.applications(tenant_id, ai_status);

-- ---------- Tenant-level settings ----------
create table if not exists public.ai_settings (
  tenant_id                uuid primary key references public.tenants(id) on delete cascade,
  enabled                  boolean not null default false,
  auto_run                 boolean not null default false,
  score_threshold          int not null default 70 check (score_threshold between 0 and 100),
  model                    text not null default 'claude-haiku-4-5-20251001',
  monthly_cost_cap_usd     numeric(10, 2) not null default 100.00,
  current_month_spend_usd  numeric(10, 4) not null default 0,
  current_month_started_at timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles(id) on delete set null
);

alter table public.ai_settings enable row level security;
create policy "ai_settings_read"
  on public.ai_settings for select
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));
create policy "ai_settings_write_admin"
  on public.ai_settings for all
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid())
         and (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin'))
  with check (tenant_id in (select tenant_id from public.profiles where id = auth.uid())
              and (select role from public.profiles where id = auth.uid()) in ('super_admin', 'admin'));

drop trigger if exists trg_ai_settings_updated on public.ai_settings;
create trigger trg_ai_settings_updated before update on public.ai_settings
  for each row execute function public.set_updated_at();
