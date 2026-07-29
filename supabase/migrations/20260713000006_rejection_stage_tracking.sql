-- =============================================================================
-- 00019 — Track which stage a candidate was in when they were rejected
--
-- Adds `applications.rejected_from_stage_id` — a nullable pointer to the stage
-- the candidate was IN at the moment they got moved into "Rejected". Kept in
-- sync automatically by `move_application_stage()` (see updated function).
--
-- Effect on existing data:
--   * schema change: adds one nullable column, no rewrites, no downtime
--   * RPC change: only affects FUTURE stage moves
--   * backfill: reads application_stage_history + writes only the new column
--     for candidates currently in Rejected. Every other field left untouched.
-- =============================================================================

-- ---------- Schema ----------
alter table public.applications
  add column if not exists rejected_from_stage_id uuid references public.stages(id) on delete set null;

comment on column public.applications.rejected_from_stage_id is
  'For rejected candidates: which stage they were IN when they got rejected. NULL for non-rejected or unknown.';

create index if not exists idx_applications_rejected_from
  on public.applications(tenant_id, rejected_from_stage_id)
  where rejected_from_stage_id is not null;

-- ---------- Updated RPC ----------
-- When moving INTO 'rejected', capture where the candidate came from.
-- When moving OUT of 'rejected' (re-consideration), clear the column so a
-- future rejection captures the correct new source stage.
create or replace function public.move_application_stage(
  p_application_id uuid,
  p_to_stage_id    uuid,
  p_comment        text default null
) returns public.application_stage_history
language plpgsql security definer set search_path = public as $$
declare
  v_app             public.applications%rowtype;
  v_from_stage_code text;
  v_to_stage_code   text;
  v_hist            public.application_stage_history%rowtype;
  v_new_rejected_from uuid;
begin
  select * into v_app from public.applications where id = p_application_id;
  if not found then raise exception 'application not found'; end if;
  if v_app.tenant_id <> public.current_tenant_id() then raise exception 'forbidden'; end if;

  -- Resolve stage codes so we can compare (avoids string-name coupling).
  select code into v_from_stage_code from public.stages where id = v_app.current_stage_id;
  select code into v_to_stage_code   from public.stages where id = p_to_stage_id;

  -- Insert history row for the transition.
  insert into public.application_stage_history (application_id, from_stage_id, to_stage_id, moved_by, comment)
  values (p_application_id, v_app.current_stage_id, p_to_stage_id, auth.uid(), p_comment)
  returning * into v_hist;

  -- Decide what to do with rejected_from_stage_id.
  if v_to_stage_code = 'rejected' then
    -- Only set if not already set — preserves the ORIGINAL rejection stage
    -- when a rejected candidate is moved-and-re-rejected as part of correction workflows.
    v_new_rejected_from := coalesce(v_app.rejected_from_stage_id, v_app.current_stage_id);
  elsif v_from_stage_code = 'rejected' then
    -- Moving OUT of rejected — clear the marker so any future re-rejection captures its own source.
    v_new_rejected_from := null;
  else
    v_new_rejected_from := v_app.rejected_from_stage_id;   -- unchanged
  end if;

  update public.applications
     set current_stage_id       = p_to_stage_id,
         rejected_from_stage_id = v_new_rejected_from,
         updated_at              = now()
   where id = p_application_id;

  return v_hist;
end $$;

-- ---------- Backfill for existing rejected candidates ----------
-- Reads the most recent transition into 'rejected' for each currently-rejected
-- application and stores its from_stage_id. Only writes to the new column,
-- only for rows currently in Rejected, only when the column is still NULL.
--
-- NOTE on UPDATE ... FROM syntax: Postgres does not allow the target table
-- (`applications`) to be re-referenced in a JOIN inside the FROM clause.
-- The "current stage is Rejected" check is expressed as an IN subselect
-- against public.stages instead.
update public.applications a
   set rejected_from_stage_id = h.from_stage_id
  from (
    select distinct on (ash.application_id)
           ash.application_id,
           ash.from_stage_id
      from public.application_stage_history ash
      join public.stages s on s.id = ash.to_stage_id
     where s.code = 'rejected'
     order by ash.application_id, ash.moved_at desc
  ) h
 where a.id = h.application_id
   and a.rejected_from_stage_id is null
   and a.current_stage_id in (
     select id from public.stages where code = 'rejected'
   );
