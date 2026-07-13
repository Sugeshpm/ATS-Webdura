-- =============================================================================
-- 00014 — Public intake API (WordPress careers form → HRM)
--
-- Adds:
--   * public_intake_credentials — per-tenant API key + encrypted HMAC secret
--   * applications_intake_log   — audit trail (dedup by idempotency_key)
--   * intake_rate_limits        — per-(api_key, ip) rate-limit buckets
--   * check_intake_rate_limit() — atomic upsert-and-check RPC
--
-- All three tables are service-role-only (no RLS grants for authenticated).
-- The intake route runs with the service role because a public form has no
-- Supabase session.
-- =============================================================================

create table if not exists public.public_intake_credentials (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  name                  text not null,                        -- e.g. "Webdura WP Careers"
  api_key               text not null unique,                 -- public identifier, sent in header
  api_secret_encrypted  text not null,                        -- AES-256-GCM (META_ENCRYPTION_KEY)
  default_job_id        uuid references public.jobs(id) on delete set null,  -- fallback if job_title doesn't match
  allowed_origins       text[] not null default '{}',         -- CORS-style origin allowlist; empty = allow any
  is_active             boolean not null default true,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  revoked_at            timestamptz
);
create index if not exists idx_intake_creds_tenant on public.public_intake_credentials(tenant_id);
create index if not exists idx_intake_creds_active on public.public_intake_credentials(api_key) where is_active = true and revoked_at is null;

alter table public.public_intake_credentials enable row level security;
-- No policies granted — service role bypasses RLS. Authenticated users cannot read secrets.

-- -----------------------------------------------------------------------------
create table if not exists public.applications_intake_log (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references public.tenants(id) on delete set null,
  api_key             text,
  idempotency_key     text,
  ip                  inet,
  origin              text,
  status              int not null,                            -- HTTP status returned
  outcome             text not null,                            -- 'inserted' | 'duplicate' | 'rejected' | 'error'
  candidate_id        uuid references public.candidates(id) on delete set null,
  application_id      uuid references public.applications(id) on delete set null,
  error               text,
  request_summary     jsonb,                                     -- {email, job_title, has_resume, ...}
  response_summary    jsonb,                                     -- {reference, candidate_id, application_id, ...}
  created_at          timestamptz not null default now()
);
create index if not exists idx_intake_log_tenant_created on public.applications_intake_log(tenant_id, created_at desc);
create index if not exists idx_intake_log_idem on public.applications_intake_log(tenant_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_intake_log_ip_created on public.applications_intake_log(ip, created_at desc);

alter table public.applications_intake_log enable row level security;
-- Log rows may be readable by tenant staff (helpful for debugging) — add a permissive select policy scoped to their tenant.
create policy "intake_log_read_own_tenant"
  on public.applications_intake_log for select
  using (tenant_id in (select tenant_id from public.profiles where id = auth.uid()));

-- -----------------------------------------------------------------------------
create table if not exists public.intake_rate_limits (
  bucket_key   text primary key,        -- "<api_key>:<ip>"
  count        int not null default 0,
  resets_at    timestamptz not null
);

alter table public.intake_rate_limits enable row level security;
-- Service-role only.

-- -----------------------------------------------------------------------------
-- Atomic rate-limit check. Returns TRUE if the request is allowed.
create or replace function public.check_intake_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_resets timestamptz;
begin
  insert into public.intake_rate_limits (bucket_key, count, resets_at)
    values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update
    set count = case when public.intake_rate_limits.resets_at < now() then 1 else public.intake_rate_limits.count + 1 end,
        resets_at = case when public.intake_rate_limits.resets_at < now() then now() + make_interval(secs => p_window_seconds) else public.intake_rate_limits.resets_at end
  returning count, resets_at into v_count, v_resets;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_intake_rate_limit(text, int, int) from public;
grant execute on function public.check_intake_rate_limit(text, int, int) to service_role;
