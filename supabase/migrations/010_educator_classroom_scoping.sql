-- 010_educator_classroom_scoping.sql
-- Restrict educators to only see classrooms they are assigned to,
-- and only students/observations/surveys in those classrooms.
-- Admins continue to see everything in their school.

-- ============================================================
-- 1. CLASSROOMS — educators see only their assigned classrooms
-- ============================================================

-- Drop the old all-school SELECT policy
DROP POLICY IF EXISTS "classrooms_select_school" ON classrooms;

-- Admins see all classrooms in school
CREATE POLICY "classrooms_select_admin"
  ON classrooms FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

-- Educators see only their assigned classrooms
CREATE POLICY "classrooms_select_educator"
  ON classrooms FOR SELECT
  USING (
    auth_role() = 'educator'
    AND id IN (
      SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
    )
  );

-- Parents see classrooms their children are in
CREATE POLICY "classrooms_select_parent"
  ON classrooms FOR SELECT
  USING (
    auth_role() = 'parent'
    AND id IN (
      SELECT s.classroom_id FROM students s
      JOIN parent_students ps ON ps.student_id = s.id
      WHERE ps.parent_id = auth.uid()
    )
  );

-- ============================================================
-- 2. STUDENTS — educators see only students in assigned classrooms
-- ============================================================

-- Drop old combined policy
DROP POLICY IF EXISTS "students_select_educator" ON students;

-- Admins see all students in school
CREATE POLICY "students_select_admin"
  ON students FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

-- Educators see only students in their assigned classrooms
CREATE POLICY "students_select_educator"
  ON students FOR SELECT
  USING (
    auth_role() = 'educator'
    AND classroom_id IN (
      SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
    )
  );

-- (students_select_parent policy is unchanged — already scoped via parent_students)

-- Update INSERT: educators can only add students to their assigned classrooms
DROP POLICY IF EXISTS "students_insert" ON students;

CREATE POLICY "students_insert_admin"
  ON students FOR INSERT
  WITH CHECK (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "students_insert_educator"
  ON students FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND classroom_id IN (
      SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
    )
  );

-- Update UPDATE: educators can only update students in their assigned classrooms
DROP POLICY IF EXISTS "students_update" ON students;

CREATE POLICY "students_update_admin"
  ON students FOR UPDATE
  USING (school_id = auth_school_id() AND auth_role() = 'admin')
  WITH CHECK (school_id = auth_school_id());

CREATE POLICY "students_update_educator"
  ON students FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND classroom_id IN (
      SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
    )
  )
  WITH CHECK (school_id = auth_school_id());

-- ============================================================
-- 3. OBSERVATIONS — educators see only obs for their students
-- ============================================================

DROP POLICY IF EXISTS "observations_select_educator" ON observations;

CREATE POLICY "observations_select_admin"
  ON observations FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "observations_select_educator"
  ON observations FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  );

-- (observations_select_parent is unchanged — already scoped via parent_students)

-- INSERT: educators can only observe students in their classrooms
DROP POLICY IF EXISTS "observations_insert_educator" ON observations;

CREATE POLICY "observations_insert_admin"
  ON observations FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'admin'
    AND observer_id = auth.uid()
  );

CREATE POLICY "observations_insert_educator"
  ON observations FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND observer_id = auth.uid()
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  );

-- UPDATE: educators can only update their own obs for their students
DROP POLICY IF EXISTS "observations_update_educator" ON observations;

CREATE POLICY "observations_update_admin"
  ON observations FOR UPDATE
  USING (school_id = auth_school_id() AND auth_role() = 'admin' AND observer_id = auth.uid())
  WITH CHECK (school_id = auth_school_id());

CREATE POLICY "observations_update_educator"
  ON observations FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND observer_id = auth.uid()
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  )
  WITH CHECK (school_id = auth_school_id());

-- ============================================================
-- 4. INTEREST SURVEYS — educators see only their students' surveys
-- ============================================================

DROP POLICY IF EXISTS "interest_surveys_select_staff" ON interest_surveys;

CREATE POLICY "interest_surveys_select_admin"
  ON interest_surveys FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "interest_surveys_select_educator"
  ON interest_surveys FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  );

-- (interest_surveys_select_parent is unchanged — already scoped via parent_students)

-- ============================================================
-- 5. STUDENT SESSIONS — educators can only manage sessions
--    for students in their classrooms
-- ============================================================

DROP POLICY IF EXISTS "student_sessions_select_educator" ON student_sessions;
DROP POLICY IF EXISTS "student_sessions_insert_educator" ON student_sessions;
DROP POLICY IF EXISTS "student_sessions_delete_educator" ON student_sessions;

-- SELECT
CREATE POLICY "student_sessions_select_admin"
  ON student_sessions FOR SELECT
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "student_sessions_select_educator"
  ON student_sessions FOR SELECT
  USING (
    auth_role() = 'educator'
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  );

-- INSERT
CREATE POLICY "student_sessions_insert_admin"
  ON student_sessions FOR INSERT
  WITH CHECK (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "student_sessions_insert_educator"
  ON student_sessions FOR INSERT
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() = 'educator'
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  );

-- DELETE
CREATE POLICY "student_sessions_delete_admin"
  ON student_sessions FOR DELETE
  USING (school_id = auth_school_id() AND auth_role() = 'admin');

CREATE POLICY "student_sessions_delete_educator"
  ON student_sessions FOR DELETE
  USING (
    auth_role() = 'educator'
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT classroom_id FROM educator_classrooms WHERE educator_id = auth.uid()
      )
    )
  );
