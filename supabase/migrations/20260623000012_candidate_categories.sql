-- =============================================================================
-- 00012 — Candidate categories
--
-- Replaces the single is_archived boolean on candidates with a 4-value
-- category column: active | talent_pool | archived | duplicate.
--
-- Other tables (departments, locations, stages, applications) keep their own
-- is_archived columns — different concepts, unaffected.
-- =============================================================================

-- 1. Add category column with default + check constraint.
alter table public.candidates
  add column if not exists category text not null default 'active'
  check (category in ('active', 'talent_pool', 'archived', 'duplicate'));

create index if not exists idx_candidates_tenant_category
  on public.candidates(tenant_id, category);

-- 2. Backfill from is_archived (preserve archived state), then drop the column.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'candidates' and column_name = 'is_archived'
  ) then
    update public.candidates set category = 'archived' where is_archived = true;
    alter table public.candidates drop column is_archived;
  end if;
end $$;
