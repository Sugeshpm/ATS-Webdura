-- =============================================================================
-- 00008 — Convenience views & RPCs
-- =============================================================================

-- Active jobs with derived counts for the Active Jobs grid.
create or replace view public.v_jobs_with_counts as
select
  j.*,
  d.name as department_name,
  l.name as location_name,
  bu.name as business_unit_name,
  coalesce(stat.candidate_count, 0)   as candidate_count,
  coalesce(stat.new_count, 0)         as new_candidates_count,
  coalesce(stat.archived_count, 0)    as archived_candidates_count
from public.jobs j
left join public.departments d    on d.id = j.department_id
left join public.locations l      on l.id = j.location_id
left join public.business_units bu on bu.id = j.business_unit_id
left join lateral (
  select
    count(*)                                          as candidate_count,
    count(*) filter (where a.applied_at > now() - interval '7 days') as new_count,
    count(*) filter (where a.is_archived)             as archived_count
  from public.applications a
  where a.job_id = j.id
) stat on true;

-- RPC: move an application to a new stage and log history atomically
create or replace function public.move_application_stage(
  p_application_id uuid,
  p_to_stage_id    uuid,
  p_comment        text default null
) returns public.application_stage_history
language plpgsql security definer set search_path = public as $$
declare
  v_app    public.applications%rowtype;
  v_hist   public.application_stage_history%rowtype;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then raise exception 'application not found'; end if;
  if v_app.tenant_id <> public.current_tenant_id() then raise exception 'forbidden'; end if;

  insert into public.application_stage_history (application_id, from_stage_id, to_stage_id, moved_by, comment)
  values (p_application_id, v_app.current_stage_id, p_to_stage_id, auth.uid(), p_comment)
  returning * into v_hist;

  update public.applications
     set current_stage_id = p_to_stage_id, updated_at = now()
   where id = p_application_id;

  return v_hist;
end $$;

-- RPC: funnel report per job
create or replace function public.job_funnel(p_job_id uuid)
returns table(stage_id uuid, stage_name text, stage_order int, count bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s."order", count(a.id)
  from public.stages s
  left join public.applications a
    on a.current_stage_id = s.id
   and a.job_id = p_job_id
   and a.tenant_id = public.current_tenant_id()
  where s.tenant_id = public.current_tenant_id()
  group by s.id, s.name, s."order"
  order by s."order";
$$;
