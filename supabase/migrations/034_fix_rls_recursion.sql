-- 034_fix_rls_recursion.sql
-- Fixes infinite RLS recursion between classrooms ↔ students.
--
-- Root cause: classrooms_select_parent queries `students`, which triggers
-- students RLS evaluation.  students_select_dept_admin queries `classrooms`,
-- which triggers classrooms RLS evaluation again → infinite loop.
--
-- Fix: wrap the cross-table lookups in SECURITY DEFINER functions so they
-- bypass RLS and break the cycle.

-- ============================================================
-- 1. Helper: classroom IDs visible to a department admin
--    (bypasses RLS on classrooms to break the students→classrooms cycle)
-- ============================================================

CREATE OR REPLACE FUNCTION get_department_classroom_ids(p_user_id uuid)
RETURNS SETOF uuid AS $$
  SELECT c.id FROM classrooms c
  WHERE c.department_id IN (
    SELECT department_id FROM department_admins WHERE user_id = p_user_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. Helper: classroom IDs visible to a parent
--    (bypasses RLS on students/parent_students to break the
--     classrooms→students cycle)
-- ============================================================

CREATE OR REPLACE FUNCTION get_parent_classroom_ids(p_parent_id uuid)
RETURNS SETOF uuid AS $$
  SELECT DISTINCT s.classroom_id
  FROM students s
  JOIN parent_students ps ON ps.student_id = s.id
  WHERE ps.parent_id = p_parent_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 3. Helper: student IDs visible to a department admin
--    (bypasses RLS on students & classrooms)
-- ============================================================

CREATE OR REPLACE FUNCTION get_department_student_ids(p_user_id uuid)
RETURNS SETOF uuid AS $$
  SELECT s.id FROM students s
  WHERE s.classroom_id IN (
    SELECT get_department_classroom_ids(p_user_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 4. Replace classrooms_select_parent to use helper
-- ============================================================

DROP POLICY IF EXISTS "classrooms_select_parent" ON classrooms;
CREATE POLICY "classrooms_select_parent"
  ON classrooms FOR SELECT
  USING (
    auth_role() = 'parent'
    AND id IN (SELECT get_parent_classroom_ids(auth.uid()))
  );

-- ============================================================
-- 5. Replace dept-admin policies to use helpers
-- ============================================================

-- 5a. students_select_dept_admin
DROP POLICY IF EXISTS "students_select_dept_admin" ON students;
CREATE POLICY "students_select_dept_admin"
  ON students FOR SELECT
  USING (
    is_department_admin()
    AND classroom_id IN (SELECT get_department_classroom_ids(auth.uid()))
  );

-- 5b. observations_select_dept_admin
DROP POLICY IF EXISTS "observations_select_dept_admin" ON observations;
CREATE POLICY "observations_select_dept_admin"
  ON observations FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (SELECT get_department_student_ids(auth.uid()))
  );

-- 5c. parent_students_select_dept_admin
DROP POLICY IF EXISTS "parent_students_select_dept_admin" ON parent_students;
CREATE POLICY "parent_students_select_dept_admin"
  ON parent_students FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (SELECT get_department_student_ids(auth.uid()))
  );

-- 5d. interest_surveys_select_dept_admin
DROP POLICY IF EXISTS "interest_surveys_select_dept_admin" ON interest_surveys;
CREATE POLICY "interest_surveys_select_dept_admin"
  ON interest_surveys FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (SELECT get_department_student_ids(auth.uid()))
  );

-- 5e. student_sessions_select_dept_admin
DROP POLICY IF EXISTS "student_sessions_select_dept_admin" ON student_sessions;
CREATE POLICY "student_sessions_select_dept_admin"
  ON student_sessions FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (SELECT get_department_student_ids(auth.uid()))
  );
