-- =============================================================================
-- 00021 — Denormalize candidate experience onto applications for fast sorts
--
-- Supabase-js's .order({ referencedTable }) doesn't sort parent rows by an
-- embedded to-one relation. To sort applications by candidate experience
-- (or any candidate column) at the database level, the column has to live
-- on the applications table itself.
--
-- This migration:
--   1. Adds candidate_experience_years / candidate_experience_months on applications
--   2. Backfills them from the linked candidate
--   3. Sets up two triggers so the values stay in sync:
--      - BEFORE INSERT on applications: pull from linked candidate
--      - AFTER UPDATE on candidates:   push to every linked application
-- =============================================================================

alter table public.applications
  add column if not exists candidate_experience_years  int,
  add column if not exists candidate_experience_months int;

comment on column public.applications.candidate_experience_years is
  'Denormalized from candidates.experience_years so applications can sort by it directly. Kept in sync by triggers.';

create index if not exists idx_applications_exp_years
  on public.applications(tenant_id, candidate_experience_years desc nulls last);

-- ---------- Backfill ----------
update public.applications a
   set candidate_experience_years  = c.experience_years,
       candidate_experience_months = c.experience_months
  from public.candidates c
 where a.candidate_id = c.id
   and (a.candidate_experience_years is null or a.candidate_experience_months is null);

-- ---------- Trigger 1: on INSERT into applications, seed from candidate ----------
create or replace function public.sync_application_candidate_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.candidate_id is not null
     and (new.candidate_experience_years is null or new.candidate_experience_months is null) then
    select experience_years, experience_months
      into new.candidate_experience_years, new.candidate_experience_months
      from public.candidates
     where id = new.candidate_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_applications_sync_experience on public.applications;
create trigger trg_applications_sync_experience
  before insert on public.applications
  for each row execute function public.sync_application_candidate_experience();

-- ---------- Trigger 2: on UPDATE of candidates.experience_*, propagate ----------
create or replace function public.propagate_candidate_experience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.experience_years is distinct from old.experience_years)
     or (new.experience_months is distinct from old.experience_months) then
    update public.applications
       set candidate_experience_years  = new.experience_years,
           candidate_experience_months = new.experience_months
     where candidate_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_candidates_propagate_experience on public.candidates;
create trigger trg_candidates_propagate_experience
  after update on public.candidates
  for each row execute function public.propagate_candidate_experience();
