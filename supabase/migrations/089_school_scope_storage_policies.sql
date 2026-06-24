-- 089_school_scope_storage_policies.sql
-- Tenant-isolation P0: the storage.objects policies were not school-scoped, so any
-- authenticated user could read (and in some buckets delete) files belonging to any
-- school. Re-scope SELECT/DELETE to the caller's school via the backing rows, and
-- INSERT via the object path (the DB row does not exist yet at upload time).
--
-- Path conventions (from the app upload sites):
--   school-documents:    students/{studentId}/...  notes/{studentId}/...  {schoolId}/...
--   assignment-files:     {prefix}/...   -> assignment_attachments / assessment_attachments
--   incident-attachments: {incidentId}/... -> incident_report_attachments -> incident_reports

-- ── school-documents ───────────────────────────────────────────
drop policy if exists "school_documents_storage_select" on storage.objects;
create policy "school_documents_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'school-documents' and (
      public.is_system_admin()
      or exists (select 1 from public.student_documents d
                 where d.file_path = objects.name and d.school_id = public.auth_school_id())
      or exists (select 1 from public.teacher_note_files f
                 where f.file_path = objects.name and f.school_id = public.auth_school_id())
      or (storage.foldername(objects.name))[1] = public.auth_school_id()::text
    )
  );

drop policy if exists "school_documents_storage_insert" on storage.objects;
create policy "school_documents_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'school-documents' and (
      public.is_system_admin()
      -- school-level docs are stored under a {schoolId}/ prefix
      or (storage.foldername(objects.name))[1] = public.auth_school_id()::text
      -- student / teacher-note files: validate the {studentId} path segment's school
      or (
        (storage.foldername(objects.name))[1] in ('students', 'notes')
        and (storage.foldername(objects.name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and exists (select 1 from public.students s
                    where s.id = ((storage.foldername(objects.name))[2])::uuid
                      and s.school_id = public.auth_school_id())
      )
    )
  );

drop policy if exists "school_documents_storage_delete" on storage.objects;
create policy "school_documents_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'school-documents' and (
      public.is_system_admin()
      or exists (select 1 from public.student_documents d
                 where d.file_path = objects.name and d.school_id = public.auth_school_id())
      or exists (select 1 from public.teacher_note_files f
                 where f.file_path = objects.name and f.school_id = public.auth_school_id())
      or (storage.foldername(objects.name))[1] = public.auth_school_id()::text
    )
  );

-- ── assignment-files ───────────────────────────────────────────
-- Was: readable by any authenticated user if the path matched any attachment row.
-- Now: the matching attachment must belong to the caller's school. INSERT/UPDATE/
-- DELETE keep their existing owner (uploaded_by) gating.
drop policy if exists "assignment_files_select" on storage.objects;
create policy "assignment_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-files' and (
      public.is_system_admin()
      or exists (select 1 from public.assignment_attachments aa
                 where aa.file_path = objects.name and aa.school_id = public.auth_school_id())
      or exists (select 1 from public.assessment_attachments ea
                 where ea.file_path = objects.name and ea.school_id = public.auth_school_id())
    )
  );

-- ── incident-attachments ───────────────────────────────────────
-- Keep the role gate, add school scoping (was readable/deletable across schools).
drop policy if exists "incident_attachments_read" on storage.objects;
create policy "incident_attachments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'incident-attachments'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid()
                  and p.role in ('admin', 'educator', 'parent'))
    and (
      public.is_system_admin()
      or exists (
        select 1 from public.incident_report_attachments ira
        join public.incident_reports r on r.id = ira.incident_report_id
        where ira.file_path = objects.name and r.school_id = public.auth_school_id()
      )
    )
  );

drop policy if exists "incident_attachments_upload" on storage.objects;
create policy "incident_attachments_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'incident-attachments'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('admin', 'educator'))
    and (
      public.is_system_admin()
      or (
        (storage.foldername(objects.name))[1] ~ '^[0-9a-fA-F-]{36}$'
        and exists (select 1 from public.incident_reports r
                    where r.id = ((storage.foldername(objects.name))[1])::uuid
                      and r.school_id = public.auth_school_id())
      )
    )
  );

drop policy if exists "incident_attachments_delete" on storage.objects;
create policy "incident_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'incident-attachments'
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
    and (
      public.is_system_admin()
      or exists (
        select 1 from public.incident_report_attachments ira
        join public.incident_reports r on r.id = ira.incident_report_id
        where ira.file_path = objects.name and r.school_id = public.auth_school_id()
      )
    )
  );
