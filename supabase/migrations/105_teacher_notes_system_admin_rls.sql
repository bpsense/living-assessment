-- 105_teacher_notes_system_admin_rls.sql
--
-- System admins are cross-school and carry a "home" school on their profile, so
-- auth_school_id() always resolves to that home school. teacher_notes' policies
-- gate on `school_id = auth_school_id()` with NO is_system_admin() bypass, so a
-- system admin operating in ANY other school could neither read nor add notes
-- ("new row violates row-level security policy for teacher_notes").
--
-- Fix: add the standard is_system_admin() bypass — the same pattern observations
-- (observations_manage_system_admin) and most other tables already use. Regular
-- school users are entirely unaffected (is_system_admin() is false for them).
--
-- NOTE: parent_notes, incident_reports, student_documents, and
-- student_context_documents also lack this bypass; left out deliberately
-- (parent-authored / sensitive) pending a decision on whether sysadmins should
-- write those cross-school.

-- Read any school's notes.
drop policy if exists "teacher_notes_select_system_admin" on teacher_notes;
create policy "teacher_notes_select_system_admin" on teacher_notes
  for select to authenticated
  using (is_system_admin());

-- Write notes in any school.
alter policy "teacher_notes_insert" on teacher_notes
  with check (
    is_system_admin()
    or (
      school_id = auth_school_id()
      and auth_role() in ('admin','educator')
      and author_id = auth.uid()
    )
  );

alter policy "teacher_notes_update" on teacher_notes
  using (
    is_system_admin()
    or (school_id = auth_school_id() and (author_id = auth.uid() or auth_role() = 'admin'))
  )
  with check (is_system_admin() or school_id = auth_school_id());

alter policy "teacher_notes_delete" on teacher_notes
  using (
    is_system_admin()
    or (school_id = auth_school_id() and (author_id = auth.uid() or auth_role() = 'admin'))
  );
