-- 081_dimension_standards_system_admin_select.sql
--
-- The `dimension_standards` SELECT policy from 001 only allows reads where
-- `school_id = auth_school_id()`. System admins have no school, so
-- `auth_school_id()` is null and they see zero bridges — which prevents the
-- amoeba and the Competency Snapshot from rendering anything when viewed
-- by a system admin (e.g. for support, demo, multi-school review).
--
-- Every other table the amoeba + snapshot pipeline touches (standards,
-- dimensions, assignment_standard_assessments, student_assignments,
-- student_assignment_standards, assignments) already has a parallel
-- `*_select_system_admin` policy. This migration adds the missing one
-- to keep dimension_standards consistent with the rest.

create policy "dimension_standards_select_system_admin"
  on dimension_standards for select to authenticated
  using (is_system_admin());
