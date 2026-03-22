-- 054_fix_incident_rls_recursion.sql
-- Fix infinite recursion in incident report RLS policies.
-- The problem: incident_reports SELECT checks incident_report_students,
-- which checks back on incident_reports → infinite loop.
-- Fix: junction tables use direct role/school checks instead of
-- referencing the parent incident_reports table.

-- ============================================================
-- Drop all existing policies on junction tables
-- ============================================================

DROP POLICY IF EXISTS irs_select ON public.incident_report_students;
DROP POLICY IF EXISTS irs_insert ON public.incident_report_students;
DROP POLICY IF EXISTS irs_delete ON public.incident_report_students;

DROP POLICY IF EXISTS irc_select ON public.incident_report_classrooms;
DROP POLICY IF EXISTS irc_insert ON public.incident_report_classrooms;

DROP POLICY IF EXISTS ira_select ON public.incident_report_attachments;
DROP POLICY IF EXISTS ira_insert ON public.incident_report_attachments;
DROP POLICY IF EXISTS ira_delete ON public.incident_report_attachments;

DROP POLICY IF EXISTS irfu_select ON public.incident_report_follow_ups;
DROP POLICY IF EXISTS irfu_insert ON public.incident_report_follow_ups;

DROP POLICY IF EXISTS irn_select ON public.incident_report_notifications;
DROP POLICY IF EXISTS irn_insert ON public.incident_report_notifications;
DROP POLICY IF EXISTS irn_update ON public.incident_report_notifications;

-- Also drop and recreate incident_reports policies to remove recursion
DROP POLICY IF EXISTS incident_reports_admin_all ON public.incident_reports;
DROP POLICY IF EXISTS incident_reports_educator_select ON public.incident_reports;
DROP POLICY IF EXISTS incident_reports_educator_insert ON public.incident_reports;
DROP POLICY IF EXISTS incident_reports_parent_select ON public.incident_reports;

-- ============================================================
-- incident_reports: Non-recursive policies
-- ============================================================

-- Admin/system admin: full access to their school
CREATE POLICY incident_reports_admin_all ON public.incident_reports
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid())
  );

-- Educator: can see incidents they reported or are assigned to
-- (No cross-reference to junction tables — avoids recursion)
CREATE POLICY incident_reports_educator_select ON public.incident_reports
  FOR SELECT TO authenticated
  USING (
    reported_by = auth.uid()
    OR assigned_to = auth.uid()
    OR school_id IN (
      SELECT p.school_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'educator'
    )
  );

-- Educator: can insert incidents
CREATE POLICY incident_reports_educator_insert ON public.incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- Parent: can see shared incidents for their linked students
-- Uses a direct join that doesn't trigger incident_reports policy recursion
CREATE POLICY incident_reports_parent_select ON public.incident_reports
  FOR SELECT TO authenticated
  USING (
    shared_with_family = true
    AND id IN (
      SELECT irs.incident_report_id
      FROM public.incident_report_students irs
      JOIN public.parent_students ps ON ps.student_id = irs.student_id
      WHERE ps.parent_id = auth.uid()
    )
  );

-- ============================================================
-- incident_report_students: Direct role-based access (no parent table check)
-- ============================================================

-- Educators and admins can read all junction rows in their school
CREATE POLICY irs_select ON public.incident_report_students
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
    OR
    -- Parents can see junction rows for their own students
    student_id IN (
      SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()
    )
  );

-- Educators and admins can insert junction rows
CREATE POLICY irs_insert ON public.incident_report_students
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- Only admins can delete junction rows
CREATE POLICY irs_delete ON public.incident_report_students
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- incident_report_classrooms: Direct role-based access
-- ============================================================

CREATE POLICY irc_select ON public.incident_report_classrooms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY irc_insert ON public.incident_report_classrooms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- ============================================================
-- incident_report_attachments: Direct role-based access
-- ============================================================

CREATE POLICY ira_select ON public.incident_report_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY ira_insert ON public.incident_report_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY ira_delete ON public.incident_report_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- incident_report_follow_ups: Direct role-based access
-- ============================================================

CREATE POLICY irfu_select ON public.incident_report_follow_ups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY irfu_insert ON public.incident_report_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- ============================================================
-- incident_report_notifications: User's own notifications only
-- ============================================================

CREATE POLICY irn_select ON public.incident_report_notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY irn_insert ON public.incident_report_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

CREATE POLICY irn_update ON public.incident_report_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
