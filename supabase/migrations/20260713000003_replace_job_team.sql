-- =============================================================================
-- 00016 — Atomic replace of a job's hiring team.
--
-- The Edit Job form needs to overwrite a job's team in one shot. Doing this
-- as two separate calls (DELETE, then INSERT) risks clearing the team if the
-- INSERT step fails — an inconsistent partial-save. This function does both
-- inside a single transaction, so either everything sticks or nothing does.
--
-- SECURITY INVOKER — the function runs as the caller, so the existing
-- job_team RLS policies (require job in current tenant) still apply. Do not
-- promote to SECURITY DEFINER or you break the tenant boundary.
-- =============================================================================

create or replace function public.replace_job_team(
  p_job_id              uuid,
  p_hiring_manager_ids  uuid[],
  p_recruiter_ids       uuid[],
  p_interviewer_ids     uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.job_team where job_id = p_job_id;

  if coalesce(array_length(p_hiring_manager_ids, 1), 0) > 0 then
    insert into public.job_team (job_id, user_id, role_on_job)
    select p_job_id, unnest(p_hiring_manager_ids), 'hiring_manager';
  end if;

  if coalesce(array_length(p_recruiter_ids, 1), 0) > 0 then
    insert into public.job_team (job_id, user_id, role_on_job)
    select p_job_id, unnest(p_recruiter_ids), 'recruiter';
  end if;

  if coalesce(array_length(p_interviewer_ids, 1), 0) > 0 then
    insert into public.job_team (job_id, user_id, role_on_job)
    select p_job_id, unnest(p_interviewer_ids), 'interviewer';
  end if;
end;
$$;

revoke all on function public.replace_job_team(uuid, uuid[], uuid[], uuid[]) from public;
grant execute on function public.replace_job_team(uuid, uuid[], uuid[], uuid[]) to authenticated;
