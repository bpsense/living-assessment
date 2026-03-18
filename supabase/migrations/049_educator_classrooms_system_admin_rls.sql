-- ============================================================
-- 049: Add missing system admin INSERT/DELETE policies for educator_classrooms
-- ============================================================
-- System admins could previously only SELECT educator_classrooms rows.
-- This migration adds INSERT and DELETE policies so system admins can
-- assign and unassign educators from classrooms across all schools.
-- ============================================================

CREATE POLICY "educator_classrooms_insert_system_admin"
  ON educator_classrooms FOR INSERT TO authenticated
  WITH CHECK (is_system_admin());

CREATE POLICY "educator_classrooms_delete_system_admin"
  ON educator_classrooms FOR DELETE TO authenticated
  USING (is_system_admin());
