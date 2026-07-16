-- =============================================================================
-- 00017 — Candidates listing perf pass
--
-- Two complementary changes:
--
--  1. Composite indexes on the hot query paths — most of the 5–8s tab-switch
--     lag comes from full-table scans on joined queries once the row count
--     climbs into the thousands.
--
--  2. A single `candidates_dashboard(p_job_status, p_user_id)` RPC that
--     returns everything the page shell needs (per-tab counts + sidebar job
--     list) in one round trip. Replaces six separate PostgREST calls.
-- =============================================================================

-- ---------- Indexes ----------
-- Filter on jobs.status is used every time a candidate row is fetched.
create index if not exists idx_jobs_tenant_status
  on public.jobs(tenant_id, status);

-- Candidate-centric views (talent pool / archived / duplicates) filter by
-- category and order by updated_at desc, then paginate.
create index if not exists idx_candidates_tenant_category_updated
  on public.candidates(tenant_id, category, updated_at desc);

-- Application-centric views order by updated_at desc across the tenant.
create index if not exists idx_applications_tenant_updated
  on public.applications(tenant_id, updated_at desc);

-- Only-resume documents lookup by candidate — used every page.
create index if not exists idx_documents_candidate_resume_created
  on public.documents(candidate_id, created_at desc)
  where kind = 'resume';

-- Application-centric queries filter jointly by candidates.category + jobs.status
-- via inner joins — the composite on applications(candidate_id, job_id) helps.
create index if not exists idx_applications_candidate_job
  on public.applications(candidate_id, job_id);

-- ---------- Dashboard RPC ----------
-- Returns JSON-shaped { jobs: [...], counts: {...} } for the current tenant,
-- scoped to a job-status filter and (optionally) a user id for the "My" count.
-- Executes in one round trip and reuses the caller's session so RLS still
-- applies (SECURITY INVOKER).
create or replace function public.candidates_dashboard(
  p_job_status text,
  p_user_id    uuid
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_jobs      jsonb;
  v_counts    jsonb;
begin
  select tenant_id into v_tenant_id from public.profiles where id = auth.uid();
  if v_tenant_id is null then
    return jsonb_build_object('jobs', '[]'::jsonb, 'counts', jsonb_build_object('my', 0, 'all', 0, 'talent_pool', 0, 'archived', 0, 'duplicates', 0));
  end if;

  -- Sidebar jobs list with candidate counts, scoped to the requested status.
  with jobs_for_status as (
    select j.id, j.title,
      coalesce((select count(*) from public.applications a where a.job_id = j.id), 0) as candidate_count
    from public.jobs j
    where j.tenant_id = v_tenant_id
      and j.status::text = p_job_status
    order by j.created_at desc
  )
  select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'candidate_count', candidate_count))
    into v_jobs
    from jobs_for_status;

  -- Tab counts. `my` and `all` are application-centric (candidate.category='active'
  -- and jobs.status = filter). Candidate-centric counts live in candidates joined
  -- through applications to jobs of the requested status.
  with app_counts as (
    select
      count(*) filter (where c.owner_id = p_user_id and c.category = 'active') as my,
      count(*) filter (where c.category = 'active') as all_active
    from public.applications a
    join public.candidates c on c.id = a.candidate_id
    join public.jobs j       on j.id = a.job_id
    where a.tenant_id = v_tenant_id
      and j.status::text = p_job_status
  ), cat_counts as (
    select
      count(*) filter (where c.category = 'talent_pool') as talent_pool,
      count(*) filter (where c.category = 'archived')    as archived,
      count(*) filter (where c.category = 'duplicate')   as duplicates
    from public.candidates c
    where c.tenant_id = v_tenant_id
      and exists (
        select 1 from public.applications a
        join public.jobs j on j.id = a.job_id
        where a.candidate_id = c.id
          and j.status::text = p_job_status
      )
  )
  select jsonb_build_object(
    'my',          (select my from app_counts),
    'all',         (select all_active from app_counts),
    'talent_pool', (select talent_pool from cat_counts),
    'archived',    (select archived from cat_counts),
    'duplicates',  (select duplicates from cat_counts)
  ) into v_counts;

  return jsonb_build_object('jobs', coalesce(v_jobs, '[]'::jsonb), 'counts', v_counts);
end $$;

revoke all on function public.candidates_dashboard(text, uuid) from public;
grant execute on function public.candidates_dashboard(text, uuid) to authenticated;

-- ---------- Candidate-eligibility RPC ----------
-- Returns the set of candidate ids that have at least one application to a
-- job of the given status. Used by candidate-centric queries instead of
-- pulling the entire join into JS and shoving IDs into a URL-based .in().
create or replace function public.candidate_ids_by_job_status(p_status text)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select distinct c.id
  from public.candidates c
  join public.applications a on a.candidate_id = c.id
  join public.jobs j         on j.id = a.job_id
  where c.tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and j.status::text = p_status;
$$;

revoke all on function public.candidate_ids_by_job_status(text) from public;
grant execute on function public.candidate_ids_by_job_status(text) to authenticated;
