-- 087_incident_report_enhancements.sql
-- Incident report follow-up enhancements:
--   1. Per-student severity override + per-student family visibility
--   2. Staff-only family-communication narrative fields
--   3. RLS: parent access driven by per-student visibility (not incident-level)
--   4. SECURITY DEFINER RPC for a redacted family view of involved students

-- ============================================================
-- 1. Per-student columns on incident_report_students
-- ============================================================

ALTER TABLE public.incident_report_students
  ADD COLUMN IF NOT EXISTS severity text
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS shared_with_family boolean NOT NULL DEFAULT false;

-- severity NULL = inherit the incident's severity.

-- Preserve current behaviour: if an incident was already shared with families,
-- mark every one of its linked student rows as shared.
UPDATE public.incident_report_students irs
SET shared_with_family = true
FROM public.incident_reports ir
WHERE ir.id = irs.incident_report_id
  AND ir.shared_with_family = true;

-- ============================================================
-- 2. Family-communication narrative fields on incident_reports
-- ============================================================

ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS family_communication_log text,        -- what was communicated to parents
  ADD COLUMN IF NOT EXISTS family_communication_followup text;   -- follow-up still needed

-- The incident-level shared_with_family column is intentionally kept but no
-- longer drives parent access (per-student visibility supersedes it).

-- ============================================================
-- 3. RLS — per-student family visibility
-- ============================================================

-- Parent: can see an incident when one of their linked students has a junction
-- row explicitly shared with family. Non-recursive (references the junction
-- table directly), matching the pattern established in migration 054.
DROP POLICY IF EXISTS incident_reports_parent_select ON public.incident_reports;
CREATE POLICY incident_reports_parent_select ON public.incident_reports
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT irs.incident_report_id
      FROM public.incident_report_students irs
      JOIN public.parent_students ps ON ps.student_id = irs.student_id
      WHERE ps.parent_id = auth.uid()
        AND irs.shared_with_family = true
    )
  );

-- Incident managers (assignee / reporter) can update the incident row so they
-- can change status and the communication log. Admins already have ALL via
-- incident_reports_admin_all; without this, only admins could persist updates
-- and an educator assignee's status change would silently no-op.
DROP POLICY IF EXISTS incident_reports_manager_update ON public.incident_reports;
CREATE POLICY incident_reports_manager_update ON public.incident_reports
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR reported_by = auth.uid()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR reported_by = auth.uid()
  );

-- incident_report_students SELECT: staff see all rows; parents see only their
-- own children's rows AND only when shared. This is the data-layer half of
-- redaction — a parent can never read another student's junction row.
DROP POLICY IF EXISTS irs_select ON public.incident_report_students;
CREATE POLICY irs_select ON public.incident_report_students
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'educator')
    )
    OR (
      shared_with_family = true
      AND student_id IN (
        SELECT ps.student_id FROM public.parent_students ps WHERE ps.parent_id = auth.uid()
      )
    )
  );

-- incident_report_students UPDATE: admins only (per-student severity + family
-- visibility). No UPDATE policy existed before, so updates were denied outright.
DROP POLICY IF EXISTS irs_update ON public.incident_report_students;
CREATE POLICY irs_update ON public.incident_report_students
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- 4. Redacted family view of involved students
-- ============================================================

-- Returns the involved-student list for an incident from a family's
-- perspective. The caller's own linked children (whose row is shared) are
-- revealed; every other involved student is returned fully redacted so a
-- family can see the scope of the incident without learning who else was
-- involved. SECURITY DEFINER so it can read across the (RLS-protected) tables,
-- with its own auth check inside.
CREATE OR REPLACE FUNCTION public.get_incident_family_students(p_incident_id uuid)
RETURNS TABLE (
  id uuid,
  student_id uuid,
  first_name text,
  last_name text,
  role text,
  severity text,
  redacted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be a parent with at least one linked child whose row on this
  -- incident is shared with family. Otherwise return no rows.
  IF NOT EXISTS (
    SELECT 1
    FROM public.incident_report_students irs
    JOIN public.parent_students ps ON ps.student_id = irs.student_id
    WHERE irs.incident_report_id = p_incident_id
      AND ps.parent_id = auth.uid()
      AND irs.shared_with_family = true
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    irs.id,
    CASE WHEN reveal.ok THEN irs.student_id ELSE NULL END,
    CASE WHEN reveal.ok THEN s.first_name ELSE NULL END,
    CASE WHEN reveal.ok THEN s.last_name ELSE NULL END,
    CASE WHEN reveal.ok THEN irs.role ELSE NULL END,
    CASE WHEN reveal.ok THEN COALESCE(irs.severity, ir.severity) ELSE NULL END,
    (NOT reveal.ok) AS redacted
  FROM public.incident_report_students irs
  JOIN public.incident_reports ir ON ir.id = irs.incident_report_id
  JOIN public.students s ON s.id = irs.student_id
  CROSS JOIN LATERAL (
    SELECT (
      irs.shared_with_family = true
      AND EXISTS (
        SELECT 1 FROM public.parent_students ps
        WHERE ps.student_id = irs.student_id AND ps.parent_id = auth.uid()
      )
    ) AS ok
  ) reveal
  WHERE irs.incident_report_id = p_incident_id
  ORDER BY reveal.ok DESC, irs.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_incident_family_students(uuid) TO authenticated;
