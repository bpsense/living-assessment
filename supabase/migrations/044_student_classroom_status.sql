-- 044_student_classroom_status.sql
-- Add per-classroom enrollment status (active/archived) to student_classrooms.
-- Allows soft-archiving students from individual classrooms while preserving
-- historical data (observations, assignments, etc.).

-- 1. Add status column with default 'active' (backward-compatible, no backfill needed)
ALTER TABLE student_classrooms
  ADD COLUMN status text NOT NULL DEFAULT 'active'
  CONSTRAINT student_classrooms_status_check CHECK (status IN ('active', 'archived'));

-- 2. Composite index for filtered roster queries
CREATE INDEX idx_student_classrooms_classroom_status
  ON student_classrooms(classroom_id, status);

-- 3. Educator UPDATE policy (missing from migration 043 — needed for archiving)
CREATE POLICY "student_classrooms_update_educator"
  ON student_classrooms FOR UPDATE
  USING (
    auth_role() = 'educator'
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id = auth_school_id()
    AND classroom_id IN (
      SELECT ec.classroom_id FROM educator_classrooms ec WHERE ec.educator_id = auth.uid()
    )
  );
