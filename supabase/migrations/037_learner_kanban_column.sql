-- 037_learner_kanban_column.sql
-- Adds a learner-facing kanban column to student_assignments so learners
-- can self-categorize their work into meaningful stages.
-- "Complete" is computed in the app: submitted_at IS NOT NULL AND graded_at IS NOT NULL.

-- 1. Enum for kanban columns
CREATE TYPE learner_column AS ENUM ('on_deck', 'researching', 'actively_exploring', 'blocked');

-- 2. Add column to student_assignments
ALTER TABLE student_assignments
  ADD COLUMN learner_column learner_column NOT NULL DEFAULT 'on_deck';

-- 3. Index for efficient kanban queries
CREATE INDEX idx_student_assignments_learner_column
  ON student_assignments(student_id, learner_column);

-- 4. RLS: Allow learners to read their own student_assignments
CREATE POLICY "student_assignments_select_learner"
  ON student_assignments FOR SELECT
  USING (
    auth_role() = 'learner'
    AND student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
  );

-- 5. RLS: Allow learners to update their own student_assignments
--    (move between kanban columns + submit)
CREATE POLICY "student_assignments_update_learner"
  ON student_assignments FOR UPDATE
  USING (
    auth_role() = 'learner'
    AND student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    auth_role() = 'learner'
    AND student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
  );

-- 6. Learners also need to read assignments to display card details
CREATE POLICY "assignments_select_learner"
  ON assignments FOR SELECT
  USING (
    auth_role() = 'learner'
    AND id IN (
      SELECT sa.assignment_id
      FROM student_assignments sa
      WHERE sa.student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 7. Learners need to read assignment_competencies for their assignments
CREATE POLICY "assignment_competencies_select_learner"
  ON assignment_competencies FOR SELECT
  USING (
    auth_role() = 'learner'
    AND assignment_id IN (
      SELECT sa.assignment_id
      FROM student_assignments sa
      WHERE sa.student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 8. Learners need to read competencies referenced by their assignments
CREATE POLICY "competencies_select_learner"
  ON competencies FOR SELECT
  USING (
    auth_role() = 'learner'
    AND id IN (
      SELECT ac.competency_id
      FROM assignment_competencies ac
      JOIN student_assignments sa ON sa.assignment_id = ac.assignment_id
      WHERE sa.student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 9. Learners need to read assignment_skills for their assignments
CREATE POLICY "assignment_skills_select_learner"
  ON assignment_skills FOR SELECT
  USING (
    auth_role() = 'learner'
    AND assignment_id IN (
      SELECT sa.assignment_id
      FROM student_assignments sa
      WHERE sa.student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 10. Learners need to read skills referenced by their assignments
CREATE POLICY "skills_select_learner"
  ON skills FOR SELECT
  USING (
    auth_role() = 'learner'
    AND id IN (
      SELECT ask.skill_id
      FROM assignment_skills ask
      JOIN student_assignments sa ON sa.assignment_id = ask.assignment_id
      WHERE sa.student_id = (SELECT student_id FROM profiles WHERE id = auth.uid())
    )
  );
