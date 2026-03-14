-- 043_student_multi_classroom.sql
-- Allow students to be enrolled in multiple classrooms simultaneously.
--
-- Creates a student_classrooms junction table (mirroring educator_classrooms)
-- with an is_primary flag. Keeps students.classroom_id as the "home" classroom
-- for backward compatibility, synced via trigger.
-- Updates all RLS policies to scope through the junction table.

-- ============================================================
-- 1. Create the student_classrooms junction table
-- ============================================================

CREATE TABLE student_classrooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  classroom_id  uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, classroom_id)
);

-- Enforce exactly one primary classroom per student
CREATE UNIQUE INDEX idx_student_classrooms_primary
  ON student_classrooms(student_id) WHERE is_primary = true;

CREATE INDEX idx_student_classrooms_student ON student_classrooms(student_id);
CREATE INDEX idx_student_classrooms_classroom ON student_classrooms(classroom_id);
CREATE INDEX idx_student_classrooms_school ON student_classrooms(school_id);

-- ============================================================
-- 2. Seed junction table from existing students.classroom_id
-- ============================================================

INSERT INTO student_classrooms (student_id, classroom_id, school_id, is_primary)
SELECT id, classroom_id, school_id, true
FROM students
WHERE classroom_id IS NOT NULL;

-- ============================================================
-- 3. Sync trigger: when students.classroom_id changes,
--    update the junction table to keep them in sync
-- ============================================================

CREATE OR REPLACE FUNCTION sync_student_primary_classroom()
RETURNS trigger AS $$
BEGIN
  -- On INSERT: create junction table entry
  IF TG_OP = 'INSERT' THEN
    INSERT INTO student_classrooms (student_id, classroom_id, school_id, is_primary)
    VALUES (NEW.id, NEW.classroom_id, NEW.school_id, true)
    ON CONFLICT (student_id, classroom_id) DO UPDATE SET is_primary = true;
    RETURN NEW;
  END IF;

  -- On UPDATE: if classroom_id changed, update junction table
  IF TG_OP = 'UPDATE' AND OLD.classroom_id IS DISTINCT FROM NEW.classroom_id THEN
    -- Remove primary flag from old classroom
    UPDATE student_classrooms
    SET is_primary = false
    WHERE student_id = NEW.id
      AND classroom_id = OLD.classroom_id
      AND is_primary = true;

    -- Upsert new primary classroom
    INSERT INTO student_classrooms (student_id, classroom_id, school_id, is_primary)
    VALUES (NEW.id, NEW.classroom_id, NEW.school_id, true)
    ON CONFLICT (student_id, classroom_id) DO UPDATE SET is_primary = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_student_primary_classroom
  AFTER INSERT OR UPDATE OF classroom_id ON students
  FOR EACH ROW EXECUTE FUNCTION sync_student_primary_classroom();

-- ============================================================
-- 4. RLS on student_classrooms
-- ============================================================

ALTER TABLE student_classrooms ENABLE ROW LEVEL SECURITY;

-- Admin: full access for their school
CREATE POLICY "student_classrooms_select_admin"
  ON student_classrooms FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "student_classrooms_insert_admin"
  ON student_classrooms FOR INSERT
  WITH CHECK (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "student_classrooms_update_admin"
  ON student_classrooms FOR UPDATE
  USING (school_id = auth_school_id() AND auth_role() = 'admin')
  WITH CHECK (school_id = auth_school_id());

CREATE POLICY "student_classrooms_delete_admin"
  ON student_classrooms FOR DELETE
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

-- Educator: manage enrollments for their assigned classrooms
CREATE POLICY "student_classrooms_select_educator"
  ON student_classrooms FOR SELECT
  USING (
    auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );

CREATE POLICY "student_classrooms_insert_educator"
  ON student_classrooms FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );

CREATE POLICY "student_classrooms_delete_educator"
  ON student_classrooms FOR DELETE
  USING (
    auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );

-- Parent: read enrollments for their linked students
CREATE POLICY "student_classrooms_select_parent"
  ON student_classrooms FOR SELECT
  USING (
    auth_role() = 'parent'
    AND student_id IN (
      SELECT ps.student_id FROM parent_students ps WHERE ps.parent_id = auth.uid()
    )
  );

-- Department admin: read enrollments in their department classrooms
CREATE POLICY "student_classrooms_select_dept_admin"
  ON student_classrooms FOR SELECT
  USING (
    is_department_admin()
    AND classroom_id IN (SELECT get_department_classroom_ids(auth.uid()))
  );

-- Learner: read own enrollments
CREATE POLICY "student_classrooms_select_learner"
  ON student_classrooms FOR SELECT
  USING (
    auth_access_level() = 1
    AND student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================
-- 5. SECURITY DEFINER helpers for junction table lookups
--    (prevents RLS recursion cycles)
-- ============================================================

-- Get all student IDs enrolled in a given set of classrooms (bypasses RLS)
CREATE OR REPLACE FUNCTION get_classroom_student_ids(p_classroom_ids uuid[])
RETURNS SETOF uuid AS $$
  SELECT DISTINCT sc.student_id
  FROM student_classrooms sc
  WHERE sc.classroom_id = ANY(p_classroom_ids);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get student IDs visible to an educator (via their classroom assignments)
CREATE OR REPLACE FUNCTION get_educator_student_ids(p_educator_id uuid)
RETURNS SETOF uuid AS $$
  SELECT DISTINCT sc.student_id
  FROM student_classrooms sc
  WHERE sc.classroom_id IN (
    SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = p_educator_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get classroom IDs for a student (bypasses RLS)
CREATE OR REPLACE FUNCTION get_student_classroom_ids(p_student_id uuid)
RETURNS SETOF uuid AS $$
  SELECT sc.classroom_id
  FROM student_classrooms sc
  WHERE sc.student_id = p_student_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Update get_parent_classroom_ids to use junction table
CREATE OR REPLACE FUNCTION get_parent_classroom_ids(p_parent_id uuid)
RETURNS SETOF uuid AS $$
  SELECT DISTINCT sc.classroom_id
  FROM student_classrooms sc
  JOIN parent_students ps ON ps.student_id = sc.student_id
  WHERE ps.parent_id = p_parent_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Update get_department_student_ids to use junction table
CREATE OR REPLACE FUNCTION get_department_student_ids(p_user_id uuid)
RETURNS SETOF uuid AS $$
  SELECT DISTINCT sc.student_id
  FROM student_classrooms sc
  WHERE sc.classroom_id IN (
    SELECT get_department_classroom_ids(p_user_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 6. Update STUDENTS RLS policies (migration 010)
-- ============================================================

-- Educator: see students in any of their assigned classrooms
DROP POLICY IF EXISTS "students_select_educator" ON students;
CREATE POLICY "students_select_educator"
  ON students FOR SELECT
  USING (
    auth_role() = 'educator'
    AND id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "students_insert_educator" ON students;
CREATE POLICY "students_insert_educator"
  ON students FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "students_update_educator" ON students;
CREATE POLICY "students_update_educator"
  ON students FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND id IN (SELECT get_educator_student_ids(auth.uid()))
  )
  WITH CHECK (school_id = auth_school_id());

-- Department admin: see students enrolled in their department classrooms
DROP POLICY IF EXISTS "students_select_dept_admin" ON students;
CREATE POLICY "students_select_dept_admin"
  ON students FOR SELECT
  USING (
    is_department_admin()
    AND id IN (SELECT get_department_student_ids(auth.uid()))
  );

-- ============================================================
-- 7. Update OBSERVATIONS RLS policies (migration 010)
-- ============================================================

DROP POLICY IF EXISTS "observations_select_educator" ON observations;
CREATE POLICY "observations_select_educator"
  ON observations FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "observations_insert_educator" ON observations;
CREATE POLICY "observations_insert_educator"
  ON observations FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND observer_id = auth.uid()
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "observations_update_educator" ON observations;
CREATE POLICY "observations_update_educator"
  ON observations FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND observer_id = auth.uid()
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  )
  WITH CHECK (school_id = auth_school_id());

-- observations_select_dept_admin already uses get_department_student_ids (no change needed)

-- ============================================================
-- 8. Update INTEREST_SURVEYS RLS policies (migration 010)
-- ============================================================

DROP POLICY IF EXISTS "interest_surveys_select_educator" ON interest_surveys;
CREATE POLICY "interest_surveys_select_educator"
  ON interest_surveys FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

-- interest_surveys_select_dept_admin already uses get_department_student_ids (no change needed)

-- ============================================================
-- 9. Update STUDENT_SESSIONS RLS policies (migration 010)
-- ============================================================

DROP POLICY IF EXISTS "student_sessions_select_educator" ON student_sessions;
CREATE POLICY "student_sessions_select_educator"
  ON student_sessions FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "student_sessions_insert_educator" ON student_sessions;
CREATE POLICY "student_sessions_insert_educator"
  ON student_sessions FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "student_sessions_delete_educator" ON student_sessions;
CREATE POLICY "student_sessions_delete_educator"
  ON student_sessions FOR DELETE
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

-- student_sessions_select_dept_admin already uses get_department_student_ids (no change needed)

-- ============================================================
-- 10. Update LEARNING_SUGGESTIONS RLS policies (migration 011)
-- ============================================================

DROP POLICY IF EXISTS "learning_suggestions_select_educator" ON learning_suggestions;
CREATE POLICY "learning_suggestions_select_educator"
  ON learning_suggestions FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "learning_suggestions_insert_educator" ON learning_suggestions;
CREATE POLICY "learning_suggestions_insert_educator"
  ON learning_suggestions FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "learning_suggestions_update_educator" ON learning_suggestions;
CREATE POLICY "learning_suggestions_update_educator"
  ON learning_suggestions FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  )
  WITH CHECK (school_id = auth_school_id());

-- ============================================================
-- 11. Update FAMILY_SUPPORT_SUGGESTIONS RLS policies (migration 025)
-- ============================================================

DROP POLICY IF EXISTS "family_support_select_educator" ON family_support_suggestions;
CREATE POLICY "family_support_select_educator"
  ON family_support_suggestions FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "family_support_insert_educator" ON family_support_suggestions;
CREATE POLICY "family_support_insert_educator"
  ON family_support_suggestions FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "family_support_update_educator" ON family_support_suggestions;
CREATE POLICY "family_support_update_educator"
  ON family_support_suggestions FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND student_id IN (SELECT get_educator_student_ids(auth.uid()))
  )
  WITH CHECK (school_id = auth_school_id());

-- ============================================================
-- 12. Update parent messaging helper (migration 038)
--     search_parent_contactable_users uses s.classroom_id = ec.classroom_id
-- ============================================================

CREATE OR REPLACE FUNCTION search_parent_contactable_users(
  p_parent_id uuid,
  p_query text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  role text
) AS $$
  SELECT DISTINCT pr.id, pr.full_name, pr.avatar_url, pr.role::text
  FROM profiles pr
  WHERE pr.is_active = true
    AND pr.id != p_parent_id
    AND pr.full_name ILIKE '%' || p_query || '%'
    AND (
      -- Educators assigned to classrooms of the parent's linked children
      (
        pr.role = 'educator'
        AND pr.id IN (
          SELECT ec.educator_id
          FROM educator_classrooms ec
          JOIN student_classrooms sc ON sc.classroom_id = ec.classroom_id
          JOIN parent_students ps ON ps.student_id = sc.student_id
          WHERE ps.parent_id = p_parent_id
        )
      )
      OR
      -- School admins in the same school
      (
        pr.role = 'admin'
        AND pr.school_id = (SELECT school_id FROM profiles WHERE id = p_parent_id)
      )
    )
  ORDER BY pr.full_name
  LIMIT 20;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
