-- 106_system_admin_write_bypass.sql
--
-- Extends the cross-school system-admin write bypass (105 did teacher_notes) to
-- the remaining school-scoped tables that lacked it, so a system admin operating
-- in any school can read/write them — consistent with observations
-- (observations_manage_system_admin) and teacher_notes (105).
--
-- Implemented as additive permissive FOR ALL policies: they OR with the existing
-- per-role policies and are no-ops for non-system-admins (is_system_admin() is
-- false), so regular school users are entirely unaffected.

drop policy if exists "parent_notes_system_admin_manage" on parent_notes;
create policy "parent_notes_system_admin_manage" on parent_notes
  for all to authenticated
  using (is_system_admin()) with check (is_system_admin());

drop policy if exists "incident_reports_system_admin_manage" on incident_reports;
create policy "incident_reports_system_admin_manage" on incident_reports
  for all to authenticated
  using (is_system_admin()) with check (is_system_admin());

drop policy if exists "student_documents_system_admin_manage" on student_documents;
create policy "student_documents_system_admin_manage" on student_documents
  for all to authenticated
  using (is_system_admin()) with check (is_system_admin());

drop policy if exists "student_context_documents_system_admin_manage" on student_context_documents;
create policy "student_context_documents_system_admin_manage" on student_context_documents
  for all to authenticated
  using (is_system_admin()) with check (is_system_admin());
