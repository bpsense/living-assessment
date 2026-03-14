-- Fix infinite recursion in assignments RLS policies.
--
-- The cycle was:
--   student_assignments INSERT → SELECT assignments → assignments_select_learner
--   → SELECT student_assignments → student_assignments_select → SELECT assignments → ∞
--
-- Solution: a SECURITY DEFINER helper that queries student_assignments
-- without triggering RLS, breaking the cycle.

-- 1. Helper: get assignment IDs visible to the current learner (bypasses RLS)
CREATE OR REPLACE FUNCTION learner_visible_assignment_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.assignment_id
  FROM student_assignments sa
  WHERE sa.student_id = (
    SELECT p.student_id FROM profiles p WHERE p.id = auth.uid()
  )
$$;

-- 2. Replace the recursive policy with one that uses the helper
DROP POLICY IF EXISTS assignments_select_learner ON assignments;
CREATE POLICY assignments_select_learner ON assignments
  FOR SELECT USING (
    auth_role() = 'learner'::user_role
    AND id IN (SELECT learner_visible_assignment_ids())
  );
