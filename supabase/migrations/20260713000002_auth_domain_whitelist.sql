-- =============================================================================
-- 00015 — Domain restriction + email whitelist for signup (Google OAuth aware)
--
-- Signup (email/password OR Google OAuth) is now gated at the DB level:
--   * Email domain matches an entry in `auth_allowed_domains` → allowed
--   * OR full email address matches an entry in `auth_email_whitelist` → allowed
--   * Otherwise the new profile is created with status = 'rejected' so the
--     app's existing status-aware login flow blocks the sign-in with the
--     "declined" banner. The Supabase auth.users row is left in place so a
--     super_admin can whitelist and re-approve without recreating the user.
--
-- Seeded domains: webduratech.com, webdura.in.
-- =============================================================================

create table if not exists public.auth_allowed_domains (
  domain      citext primary key,          -- e.g. 'webduratech.com'
  added_by    uuid references public.profiles(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.auth_email_whitelist (
  email       citext primary key,          -- full address, e.g. 'contractor@gmail.com'
  added_by    uuid references public.profiles(id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now()
);

alter table public.auth_allowed_domains  enable row level security;
alter table public.auth_email_whitelist  enable row level security;

-- Any authenticated user can read (needed so the app can show what's allowed).
-- Only super_admins can insert/delete — enforced in policy.
create policy "auth_allowed_domains_read"
  on public.auth_allowed_domains for select using (auth.role() = 'authenticated');
create policy "auth_email_whitelist_read"
  on public.auth_email_whitelist for select using (auth.role() = 'authenticated');

create policy "auth_allowed_domains_write_super_admin"
  on public.auth_allowed_domains for all
  using ((select role from public.profiles where id = auth.uid()) = 'super_admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'super_admin');
create policy "auth_email_whitelist_write_super_admin"
  on public.auth_email_whitelist for all
  using ((select role from public.profiles where id = auth.uid()) = 'super_admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'super_admin');

-- Seed defaults. Safe to run again — primary key stops duplicates.
insert into public.auth_allowed_domains (domain, reason) values
  ('webduratech.com', 'Corporate domain (default)'),
  ('webdura.in',      'Corporate domain (default)')
on conflict (domain) do nothing;

-- Helper — returns TRUE if the email is on the whitelist OR its domain is allowed.
-- SECURITY DEFINER so it can be called from triggers regardless of caller role.
create or replace function public.is_email_allowed(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_domain text;
begin
  if p_email is null or p_email = '' then return false; end if;
  v_domain := lower(split_part(p_email, '@', 2));
  if v_domain = '' then return false; end if;

  if exists (select 1 from public.auth_email_whitelist where email = p_email) then
    return true;
  end if;
  if exists (select 1 from public.auth_allowed_domains where domain = v_domain) then
    return true;
  end if;
  return false;
end;
$$;

revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- Update the signup trigger to enforce the domain/whitelist gate.
-- First user (bootstrap) is exempt — that's the initial super_admin. Admin
-- invites are also exempt — the inviter is trusted. Only self-registration
-- (email/password OR Google OAuth) goes through the check.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id    uuid;
  v_tenant_name  text;
  v_tenant_slug  text;
  v_is_invited   boolean;
  v_first_user   boolean;
  v_meta_role    text;
  v_first_name   text;
  v_last_name    text;
  v_allowed      boolean;
  v_status       text;
begin
  v_is_invited := coalesce((new.raw_user_meta_data->>'invited_by_admin')::boolean, false);
  select not exists (select 1 from public.tenants) into v_first_user;

  -- Google OAuth stores names in raw_user_meta_data with different keys than our
  -- email/password signup does. Try our keys first, then the OAuth ones.
  v_first_name := coalesce(
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'given_name',
    split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 1),
    ''
  );
  v_last_name := coalesce(
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'family_name',
    nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), '^\S+\s*', ''), ''),
    ''
  );

  if v_first_user then
    v_tenant_name := coalesce(new.raw_user_meta_data->>'tenant_name', 'My Organisation');
    v_tenant_slug := coalesce(
      new.raw_user_meta_data->>'tenant_slug',
      lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if exists (select 1 from public.tenants where slug = v_tenant_slug) then
      v_tenant_slug := v_tenant_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
    end if;

    insert into public.tenants (name, slug) values (v_tenant_name, v_tenant_slug)
    returning id into v_tenant_id;

    insert into public.profiles (id, tenant_id, email, first_name, last_name, role, status)
    values (new.id, v_tenant_id, new.email, v_first_name, v_last_name, 'super_admin', 'active');

  elsif v_is_invited then
    v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    v_meta_role := coalesce(new.raw_user_meta_data->>'role', 'recruiter');
    if v_tenant_id is null then
      select id into v_tenant_id from public.tenants order by created_at asc limit 1;
    end if;
    insert into public.profiles (id, tenant_id, email, first_name, last_name, role, status)
    values (new.id, v_tenant_id, new.email, v_first_name, v_last_name, v_meta_role, 'invited');

  else
    -- Self-registration (email/password OR Google OAuth) — apply the domain/whitelist gate.
    select id into v_tenant_id from public.tenants order by created_at asc limit 1;
    v_allowed := public.is_email_allowed(new.email);
    v_status  := case when v_allowed then 'pending' else 'rejected' end;

    insert into public.profiles (id, tenant_id, email, first_name, last_name, role, status)
    values (new.id, v_tenant_id, new.email, v_first_name, v_last_name, 'recruiter', v_status);
  end if;

  return new;
end $$;
