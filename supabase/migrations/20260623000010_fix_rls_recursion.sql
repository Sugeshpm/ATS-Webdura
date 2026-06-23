-- =============================================================================
-- 00010 — Fix RLS recursion between jobs ↔ job_team (and similar pairs)
--
-- Symptom: "infinite recursion detected in policy for relation jobs"
--   when inserting into job_team during job publish.
--
-- Cause: jobs_tenant_select queries job_team to decide visibility, and
--   job_team_tenant_all queries jobs to derive tenant — each policy needs the
--   other's table, so Postgres recurses.
--
-- Cure: wrap the cross-table lookups in SECURITY DEFINER functions that bypass
--   RLS. Same fix applied to job_stage_config and interview_panel.
-- =============================================================================

-- ---------- HELPERS ----------
create or replace function public.is_on_job_team(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.job_team
    where job_id = p_job_id and user_id = auth.uid()
  );
$$;

create or replace function public.job_in_my_tenant(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.jobs
    where id = p_job_id and tenant_id = public.current_tenant_id()
  );
$$;

create or replace function public.interview_in_my_tenant(p_interview_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.interviews
    where id = p_interview_id and tenant_id = public.current_tenant_id()
  );
$$;

-- ---------- JOBS: rewrite the confidential-visibility policy ----------
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

-- ---------- JOB_TEAM: gate via the security-definer tenant check ----------
drop policy if exists job_team_tenant_all on public.job_team;
create policy job_team_tenant_select on public.job_team
  for select using (public.job_in_my_tenant(job_id));
create policy job_team_tenant_insert on public.job_team
  for insert with check (public.job_in_my_tenant(job_id));
create policy job_team_tenant_update on public.job_team
  for update using (public.job_in_my_tenant(job_id));
create policy job_team_tenant_delete on public.job_team
  for delete using (public.job_in_my_tenant(job_id));

-- ---------- JOB_STAGE_CONFIG: same pattern ----------
drop policy if exists job_stage_config_tenant_all on public.job_stage_config;
create policy job_stage_config_tenant_select on public.job_stage_config
  for select using (public.job_in_my_tenant(job_id));
create policy job_stage_config_tenant_insert on public.job_stage_config
  for insert with check (public.job_in_my_tenant(job_id));
create policy job_stage_config_tenant_update on public.job_stage_config
  for update using (public.job_in_my_tenant(job_id));
create policy job_stage_config_tenant_delete on public.job_stage_config
  for delete using (public.job_in_my_tenant(job_id));

-- ---------- INTERVIEW_PANEL: same pattern ----------
drop policy if exists interview_panel_tenant_all on public.interview_panel;
create policy interview_panel_tenant_select on public.interview_panel
  for select using (public.interview_in_my_tenant(interview_id));
create policy interview_panel_tenant_insert on public.interview_panel
  for insert with check (public.interview_in_my_tenant(interview_id));
create policy interview_panel_tenant_update on public.interview_panel
  for update using (public.interview_in_my_tenant(interview_id));
create policy interview_panel_tenant_delete on public.interview_panel
  for delete using (public.interview_in_my_tenant(interview_id));
