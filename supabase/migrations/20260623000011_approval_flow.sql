-- =============================================================================
-- 00011 — Approval-based registration
--
-- Old flow: every signup created a new tenant + made the user a super_admin.
-- New flow:
--   - First-ever user (no tenants exist) → bootstrap: create tenant, super_admin, active.
--   - Admin-invited user (raw_user_meta_data->>invited_by_admin = 'true') → land in
--       the inviter's tenant, status = invited.
--   - Anyone else → land in the existing tenant, status = pending, role = recruiter.
--       An admin must approve before they can log in.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id    uuid;
  v_tenant_name  text;
  v_tenant_slug  text;
  v_is_invited   boolean;
  v_first_user   boolean;
  v_meta_role    text;
begin
  v_is_invited := coalesce((new.raw_user_meta_data->>'invited_by_admin')::boolean, false);
  select not exists (select 1 from public.tenants) into v_first_user;

  if v_first_user then
    -- Bootstrap: first user creates the tenant and becomes super_admin (active).
    v_tenant_name := coalesce(new.raw_user_meta_data->>'tenant_name', 'My Organisation');
    v_tenant_slug := coalesce(
      new.raw_user_meta_data->>'tenant_slug',
      lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]+', '-', 'g'))
    );
    if exists (select 1 from public.tenants where slug = v_tenant_slug) then
      v_tenant_slug := v_tenant_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
    end if;

    insert into public.tenants (name, slug)
    values (v_tenant_name, v_tenant_slug)
    returning id into v_tenant_id;

    insert into public.profiles (id, tenant_id, email, first_name, last_name, role, status)
    values (
      new.id, v_tenant_id, new.email,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      'super_admin', 'active'
    );

  elsif v_is_invited then
    -- Admin invitation. The inviter passes tenant_id + role in metadata.
    v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;
    v_meta_role := coalesce(new.raw_user_meta_data->>'role', 'recruiter');
    if v_tenant_id is null then
      -- Defensive fallback if metadata didn't carry tenant_id
      select id into v_tenant_id from public.tenants order by created_at asc limit 1;
    end if;

    insert into public.profiles (id, tenant_id, email, first_name, last_name, role, status)
    values (
      new.id, v_tenant_id, new.email,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      v_meta_role, 'invited'
    );

  else
    -- Self-registration: drop into the existing (single) tenant, awaiting approval.
    select id into v_tenant_id from public.tenants order by created_at asc limit 1;
    insert into public.profiles (id, tenant_id, email, first_name, last_name, role, status)
    values (
      new.id, v_tenant_id, new.email,
      coalesce(new.raw_user_meta_data->>'first_name', ''),
      coalesce(new.raw_user_meta_data->>'last_name', ''),
      'recruiter', 'pending'
    );
  end if;

  return new;
end $$;
