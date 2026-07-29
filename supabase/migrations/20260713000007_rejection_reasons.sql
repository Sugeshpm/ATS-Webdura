-- =============================================================================
-- 00020 — Rejection reasons + notes (Phase 2)
--
-- Adds structured "why they were rejected" data alongside the "where" from
-- Phase 1. Extends move_application_stage() to accept both, captured only
-- when moving into 'rejected', cleared when moving out.
-- =============================================================================

alter table public.applications
  add column if not exists rejection_reason_code text,
  add column if not exists rejection_notes text;

comment on column public.applications.rejection_reason_code is
  'For rejected candidates: preset reason code. NULL if not rejected or reason not captured.';
comment on column public.applications.rejection_notes is
  'For rejected candidates: free-text notes explaining the rejection.';

-- Optional soft check — recruiters should pick from a known list; but we
-- don't want to hard-error on legacy data or on tenants who prefer free text.
-- Consumer UI enforces the list.

create index if not exists idx_applications_rejection_reason
  on public.applications(tenant_id, rejection_reason_code)
  where rejection_reason_code is not null;

-- Extend move_application_stage() to accept the new fields.
create or replace function public.move_application_stage(
  p_application_id     uuid,
  p_to_stage_id        uuid,
  p_comment            text default null,
  p_rejection_reason   text default null,
  p_rejection_notes    text default null
) returns public.application_stage_history
language plpgsql security definer set search_path = public as $$
declare
  v_app             public.applications%rowtype;
  v_from_stage_code text;
  v_to_stage_code   text;
  v_hist            public.application_stage_history%rowtype;
  v_new_rejected_from  uuid;
  v_new_reason      text;
  v_new_notes       text;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then raise exception 'application not found'; end if;
  if v_app.tenant_id <> public.current_tenant_id() then raise exception 'forbidden'; end if;

  select code into v_from_stage_code from public.stages where id = v_app.current_stage_id;
  select code into v_to_stage_code   from public.stages where id = p_to_stage_id;

  insert into public.application_stage_history (application_id, from_stage_id, to_stage_id, moved_by, comment)
  values (p_application_id, v_app.current_stage_id, p_to_stage_id, auth.uid(), p_comment)
  returning * into v_hist;

  if v_to_stage_code = 'rejected' then
    -- Moving INTO rejected — capture stage + reason + notes.
    v_new_rejected_from := coalesce(v_app.rejected_from_stage_id, v_app.current_stage_id);
    v_new_reason        := coalesce(p_rejection_reason, v_app.rejection_reason_code);
    v_new_notes         := coalesce(p_rejection_notes, v_app.rejection_notes);
  elsif v_from_stage_code = 'rejected' then
    -- Moving OUT of rejected — clear everything.
    v_new_rejected_from := null;
    v_new_reason        := null;
    v_new_notes         := null;
  else
    v_new_rejected_from := v_app.rejected_from_stage_id;
    v_new_reason        := v_app.rejection_reason_code;
    v_new_notes         := v_app.rejection_notes;
  end if;

  update public.applications
     set current_stage_id       = p_to_stage_id,
         rejected_from_stage_id = v_new_rejected_from,
         rejection_reason_code  = v_new_reason,
         rejection_notes        = v_new_notes,
         updated_at              = now()
   where id = p_application_id;

  return v_hist;
end $$;

-- ---------- Reports helpers ----------

-- Rejection funnel: for each stage, count how many candidates were rejected AT that stage.
create or replace function public.rejection_funnel(p_job_id uuid default null)
returns table(stage_id uuid, stage_name text, stage_order int, rejected_count bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s."order", count(a.id)
  from public.stages s
  left join public.applications a
    on a.rejected_from_stage_id = s.id
   and a.tenant_id = public.current_tenant_id()
   and (p_job_id is null or a.job_id = p_job_id)
  where s.tenant_id = public.current_tenant_id()
    and s.is_archived = false
  group by s.id, s.name, s."order"
  order by s."order";
$$;

grant execute on function public.rejection_funnel(uuid) to authenticated;

-- Top rejection reasons across the tenant (or one job).
create or replace function public.top_rejection_reasons(p_job_id uuid default null, p_limit int default 20)
returns table(reason_code text, reason_count bigint)
language sql stable security definer set search_path = public as $$
  select rejection_reason_code, count(*)
  from public.applications
  where tenant_id = public.current_tenant_id()
    and rejection_reason_code is not null
    and (p_job_id is null or job_id = p_job_id)
  group by rejection_reason_code
  order by count(*) desc
  limit p_limit;
$$;

grant execute on function public.top_rejection_reasons(uuid, int) to authenticated;
