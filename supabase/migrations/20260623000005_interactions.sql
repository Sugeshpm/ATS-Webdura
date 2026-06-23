-- =============================================================================
-- 00005 — Interviews, feedback, messages, notes, documents, notifications, audit
-- =============================================================================

create table if not exists public.interviews (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  application_id    uuid not null references public.applications(id) on delete cascade,
  stage_id          uuid references public.stages(id) on delete set null,
  mode              interview_mode not null default 'online',
  scheduled_start   timestamptz not null,
  scheduled_end     timestamptz not null,
  location_or_link  text,
  status            interview_status not null default 'scheduled',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_interviews_tenant_app on public.interviews(tenant_id, application_id);
create index if not exists idx_interviews_tenant_time on public.interviews(tenant_id, scheduled_start);

create table if not exists public.interview_panel (
  interview_id uuid not null references public.interviews(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  is_required  boolean not null default true,
  primary key (interview_id, user_id)
);

create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  stage_id       uuid references public.stages(id) on delete set null,
  interview_id   uuid references public.interviews(id) on delete set null,
  template_id    uuid,
  submitted_by   uuid references public.profiles(id) on delete set null,
  submitted_at   timestamptz not null default now(),
  score          numeric,
  decision       text check (decision in ('strong_yes','yes','no','strong_no')),
  payload        jsonb not null default '{}'
);
create index if not exists idx_feedback_app on public.feedback(application_id);

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  application_id      uuid not null references public.applications(id) on delete cascade,
  channel             message_channel not null,
  direction           text not null check (direction in ('in','out','internal')),
  from_user_id        uuid references public.profiles(id) on delete set null,
  subject             text,
  body                text,
  attachments         jsonb not null default '[]',
  provider_message_id text,
  sent_at             timestamptz not null default now()
);
create index if not exists idx_messages_app_time on public.messages(application_id, sent_at desc);

create table if not exists public.notes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id      uuid references public.profiles(id) on delete set null,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_notes_app on public.notes(application_id, created_at desc);

create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  candidate_id    uuid references public.candidates(id) on delete cascade,
  application_id  uuid references public.applications(id) on delete cascade,
  kind            document_kind not null default 'other',
  name            text not null,
  mime            text,
  size_bytes      bigint,
  storage_bucket  text not null default 'documents',
  storage_path    text not null,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  version         int not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_documents_candidate on public.documents(candidate_id);
create index if not exists idx_documents_application on public.documents(application_id);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at, created_at desc);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_tenant_entity on public.audit_logs(tenant_id, entity, entity_id, created_at desc);
