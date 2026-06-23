-- =============================================================================
-- 00001 — Extensions, enums, helper functions, tenants, profiles
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- ENUMS ----------
do $$ begin
  create type app_role as enum (
    'super_admin','admin','hiring_manager','recruiter','interviewer','dept_head','vendor'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('draft','active','archived','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_visibility as enum ('internal','career_site','external','confidential');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_decision as enum ('pending','recommend','hold','reject');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_mode as enum ('online','onsite','phone');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_status as enum ('scheduled','completed','cancelled','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_channel as enum ('email','whatsapp','sms','note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_kind as enum ('resume','cover_letter','offer_letter','id_proof','certificate','other');
exception when duplicate_object then null; end $$;

-- ---------- HELPER: updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- TENANTS ----------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          citext unique not null,
  logo_url      text,
  primary_color text default '#8b5cf6',
  time_zone     text default 'Asia/Kolkata',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_tenants_updated before update on public.tenants for each row execute function public.set_updated_at();

-- ---------- PROFILES (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        citext not null,
  first_name   text,
  last_name    text,
  phone        text,
  avatar_url   text,
  role         app_role not null default 'recruiter',
  status       text not null default 'active', -- active | invited | disabled
  last_login_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_profiles_tenant on public.profiles(tenant_id);
create index if not exists idx_profiles_email on public.profiles(tenant_id, email);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- ---------- HELPER: current user's tenant ----------
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('super_admin','admin') from public.profiles where id = auth.uid()), false);
$$;

-- ---------- SIGNUP TRIGGER ----------
-- When a new auth.users is created, we create the tenant (from metadata) + profile.
-- The Next.js signup flow passes `tenant_name` and `tenant_slug` in user metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id   uuid;
  v_tenant_name text;
  v_tenant_slug text;
begin
  v_tenant_name := coalesce(new.raw_user_meta_data->>'tenant_name', 'My Organisation');
  v_tenant_slug := coalesce(
    new.raw_user_meta_data->>'tenant_slug',
    lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );

  -- Ensure slug unique by suffixing if needed
  if exists (select 1 from public.tenants where slug = v_tenant_slug) then
    v_tenant_slug := v_tenant_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  insert into public.tenants (name, slug)
  values (v_tenant_name, v_tenant_slug)
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, email, first_name, last_name, role)
  values (
    new.id,
    v_tenant_id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    'admin' -- the first user of a new org is admin
  );

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
