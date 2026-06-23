-- =============================================================================
-- 00007 — Storage buckets & RLS for resumes/documents/avatars
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('resumes',   'resumes',   false),
       ('documents', 'documents', false),
       ('avatars',   'avatars',   true)
on conflict (id) do nothing;

-- Path convention: <tenant_id>/<candidate_id>/<filename>
-- We extract the tenant_id (first folder) and require it to match the user's tenant.

drop policy if exists "resumes_read_own_tenant" on storage.objects;
create policy "resumes_read_own_tenant" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

drop policy if exists "resumes_write_own_tenant" on storage.objects;
create policy "resumes_write_own_tenant" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

drop policy if exists "resumes_update_own_tenant" on storage.objects;
create policy "resumes_update_own_tenant" on storage.objects
  for update using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

drop policy if exists "resumes_delete_own_tenant" on storage.objects;
create policy "resumes_delete_own_tenant" on storage.objects
  for delete using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

drop policy if exists "documents_read_own_tenant" on storage.objects;
create policy "documents_read_own_tenant" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

drop policy if exists "documents_write_own_tenant" on storage.objects;
create policy "documents_write_own_tenant" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  );

-- avatars bucket: public read, write only by owner
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_user_write" on storage.objects;
create policy "avatars_user_write" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
