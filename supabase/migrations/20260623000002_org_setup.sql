-- =============================================================================
-- 00002 — Org setup: departments, business units, locations, stages, skills, tags
-- =============================================================================

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_departments_tenant_name on public.departments(tenant_id, lower(name));

create table if not exists public.business_units (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_business_units_tenant_name on public.business_units(tenant_id, lower(name));

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  city        text,
  country     text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_locations_tenant_name on public.locations(tenant_id, lower(name));

create table if not exists public.stages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  code        text not null, -- sourced | screening | no_response | interview | tech_online | face_to_face | hr_discussion | final_shortlist | preboarding | hired | rejected | custom
  name        text not null,
  "order"     int not null default 0,
  color       text default '#a78bfa',
  is_terminal boolean not null default false,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_stages_tenant_code on public.stages(tenant_id, code);
create index if not exists idx_stages_tenant_order on public.stages(tenant_id, "order");

create table if not exists public.skills (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name      citext not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_skills_tenant_name on public.skills(tenant_id, name);

create table if not exists public.tags (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name      citext not null,
  color     text default '#a78bfa',
  created_at timestamptz not null default now()
);
create unique index if not exists uq_tags_tenant_name on public.tags(tenant_id, name);

-- Seed default stages when a new tenant is created
create or replace function public.seed_default_stages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.stages (tenant_id, code, name, "order", color, is_terminal) values
    (new.id, 'sourced',         'Sourced',          10, '#94a3b8', false),
    (new.id, 'screening',       'Screening',        20, '#60a5fa', false),
    (new.id, 'no_response',     'No Response',      30, '#f59e0b', false),
    (new.id, 'interview',       'Interview',        40, '#a78bfa', false),
    (new.id, 'tech_online',     'Tech-Online',      50, '#a78bfa', false),
    (new.id, 'face_to_face',    'Face To Face',     60, '#a78bfa', false),
    (new.id, 'hr_discussion',   'HR Discussion',    70, '#22d3ee', false),
    (new.id, 'final_shortlist', 'Final Shortlist',  80, '#34d399', false),
    (new.id, 'preboarding',     'Preboarding',      90, '#34d399', false),
    (new.id, 'hired',           'Hired',           100, '#22c55e', true),
    (new.id, 'rejected',        'Rejected',        110, '#ef4444', true);
  return new;
end $$;

drop trigger if exists trg_seed_stages on public.tenants;
create trigger trg_seed_stages
  after insert on public.tenants
  for each row execute function public.seed_default_stages();
