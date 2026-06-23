-- =============================================================================
-- 00009 — Templates (email, WhatsApp, job description, offer letter, scorecard)
-- Was referenced by `feedback.template_id` but the table itself was missing.
-- =============================================================================

create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  kind        text not null check (kind in ('email','whatsapp','job_description','offer_letter','scorecard','application_form')),
  name        text not null,
  subject     text,
  body        text,
  variables   jsonb not null default '{}',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_templates_tenant_kind on public.templates(tenant_id, kind);
create trigger trg_templates_updated before update on public.templates for each row execute function public.set_updated_at();

-- Wire the existing feedback.template_id FK (was nullable, no FK constraint before)
do $$ begin
  alter table public.feedback
    add constraint feedback_template_id_fkey
    foreign key (template_id) references public.templates(id) on delete set null;
exception when duplicate_object then null; end $$;

-- RLS
alter table public.templates enable row level security;

drop policy if exists templates_tenant_select on public.templates;
create policy templates_tenant_select on public.templates
  for select using (tenant_id = public.current_tenant_id());

drop policy if exists templates_tenant_insert on public.templates;
create policy templates_tenant_insert on public.templates
  for insert with check (tenant_id = public.current_tenant_id());

drop policy if exists templates_tenant_update on public.templates;
create policy templates_tenant_update on public.templates
  for update using (tenant_id = public.current_tenant_id());

drop policy if exists templates_tenant_delete on public.templates;
create policy templates_tenant_delete on public.templates
  for delete using (tenant_id = public.current_tenant_id());
