-- ============================================================
-- Skill Progressions: grade-banded expectations for each skill
-- ============================================================

-- Add progression support to existing skills table
ALTER TABLE skills
  ADD COLUMN IF NOT EXISTS is_assessable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_framework text DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS source_standard_code text,
  ADD COLUMN IF NOT EXISTS progression_domain text,
  ADD COLUMN IF NOT EXISTS progression_strand text;

-- Skill progression steps: one row per skill per grade level
CREATE TABLE IF NOT EXISTS skill_progression_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_level text NOT NULL,                    -- uses same values as GRADE_TO_STEP keys: 'K', '1', '2', ... '10', 'E1'-'E6'
  expectation_description text NOT NULL,        -- what mastery looks like at this grade
  example_tasks text,                           -- concrete examples of what a student would do
  prerequisite_step_id uuid REFERENCES skill_progression_steps(id),  -- links to the prior grade's step
  competency_ids uuid[] DEFAULT '{}',           -- which competencies this step maps to
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(skill_id, school_id, grade_level)
);

-- Enable RLS
ALTER TABLE skill_progression_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_steps_select" ON skill_progression_steps
  FOR SELECT USING (school_id = auth_school_id());

CREATE POLICY "skill_steps_insert" ON skill_progression_steps
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_steps_update" ON skill_progression_steps
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_steps_delete" ON skill_progression_steps
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_role() = 'admin'
  );

-- System admin policies for skill_progression_steps
CREATE POLICY "skill_steps_select_system_admin" ON skill_progression_steps
  FOR SELECT TO authenticated USING (is_system_admin());

CREATE POLICY "skill_steps_manage_system_admin" ON skill_progression_steps
  FOR ALL TO authenticated
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skill_steps_skill ON skill_progression_steps(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_steps_grade ON skill_progression_steps(grade_level);
CREATE INDEX IF NOT EXISTS idx_skill_steps_school ON skill_progression_steps(school_id);

-- ============================================================
-- Skill Assignments: assigning a specific skill step to learners
-- ============================================================

CREATE TABLE IF NOT EXISTS skill_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  classroom_id uuid REFERENCES classrooms(id) ON DELETE SET NULL,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  assigned_step_id uuid NOT NULL REFERENCES skill_progression_steps(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  assignment_type text NOT NULL DEFAULT 'class',
  title text,                                    -- optional override title
  instructions text,                             -- educator instructions for the learner
  due_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_skill_assignment_type CHECK (assignment_type IN ('class', 'individual')),
  CONSTRAINT valid_skill_assignment_status CHECK (status IN ('draft', 'active', 'completed', 'archived'))
);

-- Student-level records for skill assignments
CREATE TABLE IF NOT EXISTS student_skill_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_assignment_id uuid NOT NULL REFERENCES skill_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- The step this specific student is working on (may differ from the class-level assigned_step_id)
  student_step_id uuid NOT NULL REFERENCES skill_progression_steps(id),
  status text NOT NULL DEFAULT 'assigned',
  score numeric(3,2),                            -- 1-4 scale with 1/3 increments, same as ObservationRating
  scored_by uuid REFERENCES profiles(id),
  scored_at timestamptz,
  notes text,                                    -- qualitative feedback
  is_above_grade boolean DEFAULT false,          -- flag: is this step above the student's grade level?
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_ssa_status CHECK (status IN ('assigned', 'in_progress', 'submitted', 'graded')),
  CONSTRAINT valid_ssa_score CHECK (score IS NULL OR (score >= 0.33 AND score <= 4))
);

-- RLS for skill_assignments
ALTER TABLE skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skill_assignments_select" ON skill_assignments
  FOR SELECT USING (school_id = auth_school_id());

CREATE POLICY "skill_assignments_insert" ON skill_assignments
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_assignments_update" ON skill_assignments
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "skill_assignments_delete" ON skill_assignments
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_role() IN ('admin', 'educator')
  );

-- System admin policies for skill_assignments
CREATE POLICY "skill_assignments_select_system_admin" ON skill_assignments
  FOR SELECT TO authenticated USING (is_system_admin());

CREATE POLICY "skill_assignments_manage_system_admin" ON skill_assignments
  FOR ALL TO authenticated
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- RLS for student_skill_assignments
ALTER TABLE student_skill_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssa_select" ON student_skill_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
  );

CREATE POLICY "ssa_insert" ON student_skill_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "ssa_update" ON student_skill_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
    AND auth_role() IN ('admin', 'educator')
  );

CREATE POLICY "ssa_delete" ON student_skill_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM skill_assignments sa
      WHERE sa.id = skill_assignment_id
      AND sa.school_id = auth_school_id()
    )
    AND auth_role() = 'admin'
  );

-- System admin policies for student_skill_assignments
CREATE POLICY "ssa_select_system_admin" ON student_skill_assignments
  FOR SELECT TO authenticated USING (is_system_admin());

CREATE POLICY "ssa_manage_system_admin" ON student_skill_assignments
  FOR ALL TO authenticated
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skill_assign_school ON skill_assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_skill_assign_classroom ON skill_assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_skill_assign_skill ON skill_assignments(skill_id);
CREATE INDEX IF NOT EXISTS idx_ssa_assignment ON student_skill_assignments(skill_assignment_id);
CREATE INDEX IF NOT EXISTS idx_ssa_student ON student_skill_assignments(student_id);

-- ============================================================
-- Bridge: skill scores -> competency_scores
-- ============================================================

-- When a skill assignment is graded, write competency_scores for each
-- competency mapped to the assigned step. This keeps a single scoring pipe.
-- The source column uses a Postgres ENUM type `competency_score_source`.
-- Add the new 'skill_assessment' value to the enum.

ALTER TYPE competency_score_source ADD VALUE IF NOT EXISTS 'skill_assessment';

-- Add columns to competency_scores for skill-based scoring
ALTER TABLE competency_scores
  ADD COLUMN IF NOT EXISTS student_skill_assignment_id uuid REFERENCES student_skill_assignments(id);

-- Add above_grade flag to competency_scores so the aggregation can filter
ALTER TABLE competency_scores
  ADD COLUMN IF NOT EXISTS is_above_grade boolean DEFAULT false;

COMMENT ON TABLE skill_progression_steps IS 'Grade-level expectations for each assessable skill, forming a K-10 progression ladder';
COMMENT ON TABLE skill_assignments IS 'Discrete skill assignments to classes or individual students';
COMMENT ON TABLE student_skill_assignments IS 'Per-student records for skill assignments with scores and feedback';
