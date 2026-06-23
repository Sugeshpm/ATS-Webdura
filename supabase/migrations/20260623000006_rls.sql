-- =============================================================================
-- 00006 — Row Level Security policies
-- Multi-tenant isolation: every row's tenant_id must match current_tenant_id()
-- =============================================================================

-- Enable RLS on every table
alter table public.tenants                    enable row level security;
alter table public.profiles                   enable row level security;
alter table public.departments                enable row level security;
alter table public.business_units             enable row level security;
alter table public.locations                  enable row level security;
alter table public.stages                     enable row level security;
alter table public.skills                     enable row level security;
alter table public.tags                       enable row level security;
alter table public.jobs                       enable row level security;
alter table public.job_team                   enable row level security;
alter table public.job_stage_config           enable row level security;
alter table public.candidates                 enable row level security;
alter table public.candidate_experiences      enable row level security;
alter table public.candidate_educations       enable row level security;
alter table public.candidate_skills           enable row level security;
alter table public.candidate_tags             enable row level security;
alter table public.applications               enable row level security;
alter table public.application_stage_history  enable row level security;
alter table public.interviews                 enable row level security;
alter table public.interview_panel            enable row level security;
alter table public.feedback                   enable row level security;
alter table public.messages                   enable row level security;
alter table public.notes                      enable row level security;
alter table public.documents                  enable row level security;
alter table public.notifications              enable row level security;
alter table public.audit_logs                 enable row level security;

-- ---------- TENANTS ----------
drop policy if exists tenants_self_read on public.tenants;
create policy tenants_self_read on public.tenants
  for select using (id = public.current_tenant_id());

drop policy if exists tenants_admin_update on public.tenants;
create policy tenants_admin_update on public.tenants
  for update using (id = public.current_tenant_id() and public.is_admin());

-- ---------- PROFILES ----------
drop policy if exists profiles_tenant_read on public.profiles;
create policy profiles_tenant_read on public.profiles
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (tenant_id = public.current_tenant_id() and public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert with check (tenant_id = public.current_tenant_id() and public.is_admin());

-- ---------- GENERIC TENANT-SCOPED CRUD ----------
-- A helper macro idea (implemented as raw policies per table).
-- Pattern: SELECT/INSERT/UPDATE/DELETE allowed when tenant_id matches.

do $$
declare
  t text;
  tables text[] := array[
    'departments','business_units','locations','stages','skills','tags',
    'jobs','candidates','candidate_experiences','candidate_educations',
    'candidate_skills','candidate_tags',
    'applications','application_stage_history',
    'interviews','feedback','messages','notes','documents','notifications','audit_logs'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_tenant_select on public.%I', t, t);
    execute format('drop policy if exists %I_tenant_insert on public.%I', t, t);
    execute format('drop policy if exists %I_tenant_update on public.%I', t, t);
    execute format('drop policy if exists %I_tenant_delete on public.%I', t, t);

    if t in ('candidate_experiences','candidate_educations','candidate_skills','candidate_tags') then
      -- These tables don't carry tenant_id directly; gate via candidate join
      execute format($sql$
        create policy %I_tenant_select on public.%I for select using (
          exists (select 1 from public.candidates c where c.id = %I.candidate_id and c.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t, t);
      execute format($sql$
        create policy %I_tenant_insert on public.%I for insert with check (
          exists (select 1 from public.candidates c where c.id = candidate_id and c.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t);
      execute format($sql$
        create policy %I_tenant_update on public.%I for update using (
          exists (select 1 from public.candidates c where c.id = %I.candidate_id and c.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t, t);
      execute format($sql$
        create policy %I_tenant_delete on public.%I for delete using (
          exists (select 1 from public.candidates c where c.id = %I.candidate_id and c.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t, t);
    elsif t = 'application_stage_history' then
      -- No tenant_id column; gate via the parent application
      execute format($sql$
        create policy %I_tenant_select on public.%I for select using (
          exists (select 1 from public.applications a where a.id = %I.application_id and a.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t, t);
      execute format($sql$
        create policy %I_tenant_insert on public.%I for insert with check (
          exists (select 1 from public.applications a where a.id = application_id and a.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t);
      execute format($sql$
        create policy %I_tenant_update on public.%I for update using (
          exists (select 1 from public.applications a where a.id = %I.application_id and a.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t, t);
      execute format($sql$
        create policy %I_tenant_delete on public.%I for delete using (
          exists (select 1 from public.applications a where a.id = %I.application_id and a.tenant_id = public.current_tenant_id())
        )
      $sql$, t, t, t);
    else
      execute format('create policy %I_tenant_select on public.%I for select using (tenant_id = public.current_tenant_id())', t, t);
      execute format('create policy %I_tenant_insert on public.%I for insert with check (tenant_id = public.current_tenant_id())', t, t);
      execute format('create policy %I_tenant_update on public.%I for update using (tenant_id = public.current_tenant_id())', t, t);
      execute format('create policy %I_tenant_delete on public.%I for delete using (tenant_id = public.current_tenant_id())', t, t);
    end if;
  end loop;
end $$;

-- ---------- HELPERS to avoid RLS recursion across jobs ↔ job_team ----------
create or replace function public.is_on_job_team(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_team where job_id = p_job_id and user_id = auth.uid());
$$;

create or replace function public.job_in_my_tenant(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.jobs where id = p_job_id and tenant_id = public.current_tenant_id());
$$;

create or replace function public.interview_in_my_tenant(p_interview_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.interviews where id = p_interview_id and tenant_id = public.current_tenant_id());
$$;

-- ---------- JOB TEAM (gate via security-definer tenant check) ----------
drop policy if exists job_team_tenant_select on public.job_team;
drop policy if exists job_team_tenant_insert on public.job_team;
drop policy if exists job_team_tenant_update on public.job_team;
drop policy if exists job_team_tenant_delete on public.job_team;
create policy job_team_tenant_select on public.job_team for select using (public.job_in_my_tenant(job_id));
create policy job_team_tenant_insert on public.job_team for insert with check (public.job_in_my_tenant(job_id));
create policy job_team_tenant_update on public.job_team for update using (public.job_in_my_tenant(job_id));
create policy job_team_tenant_delete on public.job_team for delete using (public.job_in_my_tenant(job_id));

-- ---------- JOB STAGE CONFIG ----------
drop policy if exists job_stage_config_tenant_select on public.job_stage_config;
drop policy if exists job_stage_config_tenant_insert on public.job_stage_config;
drop policy if exists job_stage_config_tenant_update on public.job_stage_config;
drop policy if exists job_stage_config_tenant_delete on public.job_stage_config;
create policy job_stage_config_tenant_select on public.job_stage_config for select using (public.job_in_my_tenant(job_id));
create policy job_stage_config_tenant_insert on public.job_stage_config for insert with check (public.job_in_my_tenant(job_id));
create policy job_stage_config_tenant_update on public.job_stage_config for update using (public.job_in_my_tenant(job_id));
create policy job_stage_config_tenant_delete on public.job_stage_config for delete using (public.job_in_my_tenant(job_id));

-- ---------- INTERVIEW PANEL ----------
drop policy if exists interview_panel_tenant_select on public.interview_panel;
drop policy if exists interview_panel_tenant_insert on public.interview_panel;
drop policy if exists interview_panel_tenant_update on public.interview_panel;
drop policy if exists interview_panel_tenant_delete on public.interview_panel;
create policy interview_panel_tenant_select on public.interview_panel for select using (public.interview_in_my_tenant(interview_id));
create policy interview_panel_tenant_insert on public.interview_panel for insert with check (public.interview_in_my_tenant(interview_id));
create policy interview_panel_tenant_update on public.interview_panel for update using (public.interview_in_my_tenant(interview_id));
create policy interview_panel_tenant_delete on public.interview_panel for delete using (public.interview_in_my_tenant(interview_id));

-- ---------- CONFIDENTIAL JOBS: visibility ----------
-- Confidential jobs are visible to admins + assigned team only.
-- Uses is_on_job_team() — security definer, so no recursion into job_team policies.
drop policy if exists jobs_tenant_select on public.jobs;
create policy jobs_tenant_select on public.jobs
  for select using (
    tenant_id = public.current_tenant_id()
    and (
      confidential = false
      or public.is_admin()
      or public.is_on_job_team(id)
    )
  );
