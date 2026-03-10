-- 024_visibility_controls.sql
-- Role-based visibility & privacy controls.
-- Adds:
--   1. is_department_admin() helper function
--   2. Department-admin scoped RLS policies (classrooms, students, observations, parent_students)
--   3. school_profile_section_visible() helper for family-facing school profile toggles

-- ============================================================
-- 1. is_department_admin() helper
-- ============================================================

CREATE OR REPLACE FUNCTION is_department_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM department_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. Department-admin scoped RLS policies
-- ============================================================

-- 2a. CLASSROOMS — department admins can see classrooms in their departments
CREATE POLICY "classrooms_select_dept_admin"
  ON classrooms FOR SELECT
  USING (
    is_department_admin()
    AND department_id IN (
      SELECT department_id FROM department_admins WHERE user_id = auth.uid()
    )
  );

-- 2b. STUDENTS — department admins can see students in their department classrooms
CREATE POLICY "students_select_dept_admin"
  ON students FOR SELECT
  USING (
    is_department_admin()
    AND classroom_id IN (
      SELECT c.id FROM classrooms c
      WHERE c.department_id IN (
        SELECT department_id FROM department_admins WHERE user_id = auth.uid()
      )
    )
  );

-- 2c. OBSERVATIONS — department admins can see observations for students in their departments
CREATE POLICY "observations_select_dept_admin"
  ON observations FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT c.id FROM classrooms c
        WHERE c.department_id IN (
          SELECT department_id FROM department_admins WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 2d. PARENT_STUDENTS — department admins can see parent-student links in their departments
CREATE POLICY "parent_students_select_dept_admin"
  ON parent_students FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT c.id FROM classrooms c
        WHERE c.department_id IN (
          SELECT department_id FROM department_admins WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 2e. INTEREST_SURVEYS — department admins can see surveys for students in their departments
CREATE POLICY "interest_surveys_select_dept_admin"
  ON interest_surveys FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT c.id FROM classrooms c
        WHERE c.department_id IN (
          SELECT department_id FROM department_admins WHERE user_id = auth.uid()
        )
      )
    )
  );

-- 2f. STUDENT_SESSIONS — department admins can view sessions for students in their departments
CREATE POLICY "student_sessions_select_dept_admin"
  ON student_sessions FOR SELECT
  USING (
    is_department_admin()
    AND student_id IN (
      SELECT s.id FROM students s
      WHERE s.classroom_id IN (
        SELECT c.id FROM classrooms c
        WHERE c.department_id IN (
          SELECT department_id FROM department_admins WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================
-- 3. School profile section visibility helper
-- ============================================================

-- Uses the schools.settings JSONB column.
-- Schools can store visibility toggles at settings->'profile_visibility'->section_key.
-- Returns true (visible) by default if no setting exists.

CREATE OR REPLACE FUNCTION school_profile_section_visible(
  p_school_id uuid,
  p_section text
) RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT (settings->'profile_visibility'->>p_section)::boolean
     FROM schools WHERE id = p_school_id),
    true  -- default: visible
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
