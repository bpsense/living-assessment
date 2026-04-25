-- 056_incident_staff_tagging.sql
-- Add per-incident staff CC/FYI tagging.
-- The single-owner `assigned_to` column on incident_reports stays as-is;
-- this migration adds a separate junction for additional staff who should
-- be able to see and filter by incidents they're tagged on.

-- ============================================================
-- 1. incident_report_tagged_users — junction
-- ============================================================

CREATE TABLE IF NOT EXISTS public.incident_report_tagged_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tagged_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_report_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_tagged_users_incident
  ON public.incident_report_tagged_users(incident_report_id);
CREATE INDEX IF NOT EXISTS idx_incident_tagged_users_user
  ON public.incident_report_tagged_users(user_id);

-- ============================================================
-- 2. Extend notification_type to allow 'tagged'
-- ============================================================

ALTER TABLE public.incident_report_notifications
  DROP CONSTRAINT IF EXISTS incident_report_notifications_notification_type_check;

ALTER TABLE public.incident_report_notifications
  ADD CONSTRAINT incident_report_notifications_notification_type_check
  CHECK (notification_type IN ('new_incident', 'assigned', 'follow_up', 'status_change', 'tagged'));

-- ============================================================
-- 3. RLS — direct role-based, matching the pattern from 054
-- ============================================================

ALTER TABLE public.incident_report_tagged_users ENABLE ROW LEVEL SECURITY;

-- Educators and admins in any school can SELECT (matches the existing
-- pattern on incident_report_classrooms/students)
CREATE POLICY irtu_select ON public.incident_report_tagged_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- Educators and admins can INSERT
CREATE POLICY irtu_insert ON public.incident_report_tagged_users
  FOR INSERT TO authenticated
  WITH CHECK (
    tagged_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
  );

-- Admins can DELETE; the original tagger can also remove their own tag
CREATE POLICY irtu_delete ON public.incident_report_tagged_users
  FOR DELETE TO authenticated
  USING (
    tagged_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 4. Allow tagged users to read the parent incident
-- ============================================================
-- Existing educator SELECT policy already lets every educator in the school
-- see all incidents in their school, so tagged users already get read access
-- via that route. No additional incident_reports policy needed here.
