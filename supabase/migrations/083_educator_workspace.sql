-- 083_educator_workspace.sql
-- Supports the educator workspace features:
--   1. archived_at on student_classrooms — records WHEN a student was archived
--      from a classroom (the status flag alone has no timestamp).
--   2. educator_classroom_history — append-only intervals of educator
--      assignments. educator_classrooms rows are hard-deleted on unassign and
--      many RLS policies depend on that table only holding CURRENT assignments,
--      so we cannot soft-delete it. A separate history table lets us compute
--      true time-overlap without changing existing access semantics.
--   3. get_educator_archived_students() — returns archived learners an educator
--      taught, using true [assigned, unassigned] x [enrolled, archived] overlap.
--   4. classroom_analyses — cache for the AI classroom analysis.

-- ============================================================
-- 1. archived_at on student_classrooms
-- ============================================================

ALTER TABLE student_classrooms
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill: currently-archived rows have no historical timestamp, so treat
-- them as archived as of this migration. Going forward the app sets it.
UPDATE student_classrooms
  SET archived_at = now()
  WHERE status = 'archived' AND archived_at IS NULL;

-- ============================================================
-- 2. educator_classroom_history (append-only assignment intervals)
-- ============================================================

CREATE TABLE IF NOT EXISTS educator_classroom_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  classroom_id  uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ech_educator ON educator_classroom_history(educator_id);
CREATE INDEX IF NOT EXISTS idx_ech_classroom ON educator_classroom_history(classroom_id);
-- One open interval per (educator, classroom) at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ech_open_unique
  ON educator_classroom_history(educator_id, classroom_id)
  WHERE unassigned_at IS NULL;

-- Backfill: every current assignment is an open interval starting at created_at.
INSERT INTO educator_classroom_history (educator_id, classroom_id, school_id, assigned_at)
SELECT ec.educator_id, ec.classroom_id, ec.school_id, ec.created_at
FROM educator_classrooms ec
ON CONFLICT DO NOTHING;

-- Trigger: mirror educator_classrooms INSERT/DELETE into the history table.
CREATE OR REPLACE FUNCTION track_educator_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Defensive: close any stale open interval before opening a fresh one.
    UPDATE educator_classroom_history
      SET unassigned_at = now()
      WHERE educator_id = NEW.educator_id
        AND classroom_id = NEW.classroom_id
        AND unassigned_at IS NULL;
    INSERT INTO educator_classroom_history (educator_id, classroom_id, school_id, assigned_at)
      VALUES (NEW.educator_id, NEW.classroom_id, NEW.school_id, COALESCE(NEW.created_at, now()));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE educator_classroom_history
      SET unassigned_at = now()
      WHERE educator_id = OLD.educator_id
        AND classroom_id = OLD.classroom_id
        AND unassigned_at IS NULL;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_educator_assignment ON educator_classrooms;
CREATE TRIGGER trg_track_educator_assignment
  AFTER INSERT OR DELETE ON educator_classrooms
  FOR EACH ROW EXECUTE FUNCTION track_educator_assignment();

-- RLS — the page reads via the SECURITY DEFINER function below, but lock the
-- table down anyway: educators see their own rows, admins see their school.
ALTER TABLE educator_classroom_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ech_select_self"
  ON educator_classroom_history FOR SELECT
  USING (educator_id = auth.uid());

CREATE POLICY "ech_select_admin"
  ON educator_classroom_history FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "ech_select_system_admin"
  ON educator_classroom_history FOR SELECT
  USING (is_system_admin());

-- ============================================================
-- 3. get_educator_archived_students()
--    Archived learners an educator taught, by true time-overlap.
--    Returns one row per (student, classroom) overlapping enrollment.
-- ============================================================

CREATE OR REPLACE FUNCTION get_educator_archived_students(p_educator_id uuid)
RETURNS TABLE (
  student_id      uuid,
  first_name      text,
  last_name       text,
  preferred_name  text,
  grade_level     text,
  avatar_url      text,
  classroom_id    uuid,
  classroom_name  text,
  enrolled_at     timestamptz,
  archived_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (sc.student_id, sc.classroom_id)
    s.id,
    s.first_name,
    s.last_name,
    s.preferred_name,
    s.grade_level,
    s.avatar_url,
    c.id,
    c.name,
    sc.created_at,
    sc.archived_at
  FROM student_classrooms sc
  JOIN students s   ON s.id = sc.student_id
  JOIN classrooms c ON c.id = sc.classroom_id
  JOIN educator_classroom_history ech
    ON ech.classroom_id = sc.classroom_id
   AND ech.educator_id = p_educator_id
  WHERE sc.status = 'archived'
    -- Interval overlap (educator vs. student enrollment in the same classroom):
    --   educator: [assigned_at, COALESCE(unassigned_at, now())]
    --   student:  [created_at,  COALESCE(archived_at,  now())]
    AND ech.assigned_at <= COALESCE(sc.archived_at, now())
    AND sc.created_at   <= COALESCE(ech.unassigned_at, now())
    -- Authorization: this SECURITY DEFINER fn bypasses RLS, so callers may only
    -- query for themselves. Same-school admins / dept admins / system admins may
    -- query an educator (covers admin "view as educator" impersonation, where
    -- auth.uid() stays the admin but p_educator_id is the impersonated educator).
    AND (
      p_educator_id = auth.uid()
      OR is_system_admin()
      OR (auth_role() = 'admin' AND s.school_id = auth_school_id())
      OR (is_department_admin() AND ech.classroom_id IN (SELECT get_department_classroom_ids(auth.uid())))
    )
  ORDER BY sc.student_id, sc.classroom_id, sc.archived_at DESC NULLS LAST;
$$;

-- This function returns student PII and bypasses RLS; anon never needs it.
REVOKE EXECUTE ON FUNCTION get_educator_archived_students(uuid) FROM anon;

-- ============================================================
-- 4. classroom_analyses — AI analysis cache
-- ============================================================

CREATE TABLE IF NOT EXISTS classroom_analyses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id   uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  school_id      uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  input_hash     text NOT NULL,
  analysis       jsonb NOT NULL,
  prompt_version text NOT NULL DEFAULT 'v1',
  requested_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classroom_analyses_lookup
  ON classroom_analyses(classroom_id, input_hash, prompt_version);

ALTER TABLE classroom_analyses ENABLE ROW LEVEL SECURITY;

-- Educator: read/write analyses for classrooms they are currently assigned to.
CREATE POLICY "classroom_analyses_select_educator"
  ON classroom_analyses FOR SELECT
  USING (
    auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );

CREATE POLICY "classroom_analyses_insert_educator"
  ON classroom_analyses FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );

-- Admin: read/write for their school.
CREATE POLICY "classroom_analyses_select_admin"
  ON classroom_analyses FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "classroom_analyses_insert_admin"
  ON classroom_analyses FOR INSERT
  WITH CHECK (school_id = auth_school_id() AND auth_role() = 'admin');

-- Department admin: read for their department classrooms.
CREATE POLICY "classroom_analyses_select_dept_admin"
  ON classroom_analyses FOR SELECT
  USING (
    is_department_admin()
    AND classroom_id IN (SELECT get_department_classroom_ids(auth.uid()))
  );

-- System admin: full read/write.
CREATE POLICY "classroom_analyses_select_system_admin"
  ON classroom_analyses FOR SELECT
  USING (is_system_admin());

CREATE POLICY "classroom_analyses_insert_system_admin"
  ON classroom_analyses FOR INSERT
  WITH CHECK (is_system_admin());
