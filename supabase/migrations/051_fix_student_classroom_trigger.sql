-- ============================================================
-- 051: Fix student_classrooms trigger + add system admin policies
-- ============================================================
-- Problem: sync_student_primary_classroom() trigger fires on student
-- INSERT/UPDATE and tries to INSERT into student_classrooms, but the
-- function is NOT SECURITY DEFINER, so RLS policies block the insert.
-- This causes "Failed to add learner" errors.
--
-- Fix 1: Make the trigger function SECURITY DEFINER so it bypasses
--         RLS (it's an internal consistency operation).
-- Fix 2: Add missing system admin policies on student_classrooms
--         (INSERT, UPDATE, DELETE) so system admins can manage
--         enrollments across all schools.
-- ============================================================

-- ============================================================
-- 1. Recreate trigger function as SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION sync_student_primary_classroom()
RETURNS trigger AS $$
BEGIN
  -- On INSERT: create junction table entry
  IF TG_OP = 'INSERT' THEN
    IF NEW.classroom_id IS NOT NULL THEN
      INSERT INTO student_classrooms (student_id, classroom_id, school_id, is_primary)
      VALUES (NEW.id, NEW.classroom_id, NEW.school_id, true)
      ON CONFLICT (student_id, classroom_id) DO UPDATE SET is_primary = true;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE: if classroom_id changed, update junction table
  IF TG_OP = 'UPDATE' AND OLD.classroom_id IS DISTINCT FROM NEW.classroom_id THEN
    -- Remove primary flag from old classroom
    IF OLD.classroom_id IS NOT NULL THEN
      UPDATE student_classrooms
      SET is_primary = false
      WHERE student_id = NEW.id
        AND classroom_id = OLD.classroom_id
        AND is_primary = true;
    END IF;

    -- Upsert new primary classroom
    IF NEW.classroom_id IS NOT NULL THEN
      INSERT INTO student_classrooms (student_id, classroom_id, school_id, is_primary)
      VALUES (NEW.id, NEW.classroom_id, NEW.school_id, true)
      ON CONFLICT (student_id, classroom_id) DO UPDATE SET is_primary = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. Add system admin policies for student_classrooms
-- ============================================================

-- SELECT (system admins can see all enrollments)
CREATE POLICY "student_classrooms_select_system_admin"
  ON student_classrooms FOR SELECT TO authenticated
  USING (is_system_admin());

-- INSERT (system admins can enroll students in any school)
CREATE POLICY "student_classrooms_insert_system_admin"
  ON student_classrooms FOR INSERT TO authenticated
  WITH CHECK (is_system_admin());

-- UPDATE (system admins can update enrollments in any school)
CREATE POLICY "student_classrooms_update_system_admin"
  ON student_classrooms FOR UPDATE TO authenticated
  USING (is_system_admin());

-- DELETE (system admins can remove enrollments in any school)
CREATE POLICY "student_classrooms_delete_system_admin"
  ON student_classrooms FOR DELETE TO authenticated
  USING (is_system_admin());
