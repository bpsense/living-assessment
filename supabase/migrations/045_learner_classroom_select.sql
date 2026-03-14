-- 045_learner_classroom_select.sql
-- Allow learners to read classrooms they are enrolled in.
-- Without this, learner queries on the classrooms table return empty
-- due to RLS, breaking the "My Classrooms" display and assignment
-- classroom name joins.

-- Helper: get classroom IDs for a student (SECURITY DEFINER, bypasses RLS)
-- Already exists from migration 043, reuse it.

CREATE POLICY "classrooms_select_learner"
  ON classrooms FOR SELECT
  USING (
    auth_access_level() = 1
    AND id IN (
      SELECT get_student_classroom_ids(
        (SELECT student_id FROM profiles WHERE id = auth.uid())
      )
    )
  );
