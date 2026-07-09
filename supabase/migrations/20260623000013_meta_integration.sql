-- =============================================================================
-- 00013 — Meta (Facebook + Instagram) Lead Ads integration
-- =============================================================================

-- Extend candidates with a stable external identity (leadgen_id).
alter table public.candidates
  add column if not exists external_source text,
  add column if not exists external_id     text;

create unique index if not exists uq_candidates_external
  on public.candidates(tenant_id, external_source, external_id)
  where external_source is not null;

-- ---------- meta_lead_forms ----------
-- One row per Meta Lead Ad form we've registered.
create table if not exists public.meta_lead_forms (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants(id) on delete cascade,
  page_id                       text not null,
  page_name                     text,
  form_id                       text not null,
  form_name                     text,
  job_id                        uuid references public.jobs(id) on delete set null,
  field_mapping                 jsonb not null default '{}'::jsonb,
  is_active                     boolean not null default true,
  last_synced_at                timestamptz,
  page_access_token_encrypted   text,                                    -- base64(iv || tag || ct)
  page_access_token_expires_at  timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (tenant_id, form_id)
);
create index if not exists idx_meta_lead_forms_form on public.meta_lead_forms(form_id);
create index if not exists idx_meta_lead_forms_tenant on public.meta_lead_forms(tenant_id, is_active);
create trigger trg_meta_lead_forms_updated before update on public.meta_lead_forms for each row execute function public.set_updated_at();

-- ---------- meta_leads_raw ----------
-- Audit log of every lead we've received from Meta.
create table if not exists public.meta_leads_raw (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  leadgen_id          text not null,
  form_id             text not null,
  page_id             text not null,
  received_at         timestamptz not null default now(),
  meta_created_time   timestamptz,
  raw_payload         jsonb not null,
  candidate_id        uuid references public.candidates(id) on delete set null,
  application_id      uuid references public.applications(id) on delete set null,
  status              text not null default 'received'
                        check (status in ('received', 'mapped', 'inserted', 'duplicate', 'failed')),
  error               text,
  unique (tenant_id, leadgen_id)
);
create index if not exists idx_meta_leads_raw_status   on public.meta_leads_raw(tenant_id, status);
create index if not exists idx_meta_leads_raw_received on public.meta_leads_raw(tenant_id, received_at desc);
create index if not exists idx_meta_leads_raw_form     on public.meta_leads_raw(tenant_id, form_id, received_at desc);

-- ---------- RLS ----------
alter table public.meta_lead_forms enable row level security;
alter table public.meta_leads_raw  enable row level security;

do $$
declare
  t text;
  tables text[] := array['meta_lead_forms', 'meta_leads_raw'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_tenant_select on public.%I', t, t);
    execute format('drop policy if exists %I_tenant_insert on public.%I', t, t);
    execute format('drop policy if exists %I_tenant_update on public.%I', t, t);
    execute format('drop policy if exists %I_tenant_delete on public.%I', t, t);
    execute format('create policy %I_tenant_select on public.%I for select using (tenant_id = public.current_tenant_id())', t, t);
    execute format('create policy %I_tenant_insert on public.%I for insert with check (tenant_id = public.current_tenant_id())', t, t);
    execute format('create policy %I_tenant_update on public.%I for update using (tenant_id = public.current_tenant_id())', t, t);
    execute format('create policy %I_tenant_delete on public.%I for delete using (tenant_id = public.current_tenant_id())', t, t);
  end loop;
end $$;

-- The webhook receiver bypasses RLS via the service-role client (no session at ingest time)
-- but every other read/write must go through these policies.
