-- 055_translation_engine.sql
-- Phase 5: Translation Engine — Standards as Translation Layer.
--
-- Standards are no longer the assessment backbone. They are reference datasets
-- used to TRANSLATE a student's school-specific Learner Profile into
-- standardized transcripts on demand.
--
-- Changes:
-- 1. Add `framework_type` column to global_standards_frameworks & standards_frameworks
-- 2. Seed an NGSS framework to prove multi-framework model
-- 3. Create translation_records + translation_mappings tables
-- 4. RLS policies for translation tables

-- ============================================================
-- 1. Extend standards_frameworks with framework_type
-- ============================================================

ALTER TABLE global_standards_frameworks
  ADD COLUMN IF NOT EXISTS framework_type text NOT NULL DEFAULT 'ccss';

ALTER TABLE standards_frameworks
  ADD COLUMN IF NOT EXISTS framework_type text NOT NULL DEFAULT 'ccss';

-- Add a domain/strand column to global_standards and standards for richer structure
ALTER TABLE global_standards
  ADD COLUMN IF NOT EXISTS domain text;

ALTER TABLE standards
  ADD COLUMN IF NOT EXISTS domain text;

-- ============================================================
-- 2. Seed NGSS (Next Generation Science Standards) global framework
--    A representative subset to prove multi-framework support
-- ============================================================

DO $$
DECLARE
  v_ngss_fw_id uuid := gen_random_uuid();
  v_ps1_id uuid := gen_random_uuid();
  v_ls1_id uuid := gen_random_uuid();
  v_ess1_id uuid := gen_random_uuid();
  v_ets1_id uuid := gen_random_uuid();
BEGIN
  -- Only seed if NGSS doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM global_standards_frameworks WHERE name = 'NGSS' OR framework_type = 'ngss'
  ) THEN
    INSERT INTO global_standards_frameworks (id, name, description, version, framework_type)
    VALUES (
      v_ngss_fw_id,
      'NGSS',
      'Next Generation Science Standards — A multi-dimensional framework for science education focusing on practices, crosscutting concepts, and disciplinary core ideas.',
      '2013',
      'ngss'
    );

    -- Physical Sciences domain header
    INSERT INTO global_standards (id, framework_id, code, description, grade_level, domain, display_order)
    VALUES (v_ps1_id, v_ngss_fw_id, 'PS1', 'Matter and Its Interactions', NULL, 'Physical Sciences', 1);

    INSERT INTO global_standards (framework_id, code, description, grade_level, parent_id, domain, display_order) VALUES
    (v_ngss_fw_id, 'K-PS1-1', 'Plan and conduct an investigation to describe and classify different kinds of materials by their observable properties.', 'K', v_ps1_id, 'Physical Sciences', 1),
    (v_ngss_fw_id, '2-PS1-1', 'Plan and conduct an investigation to describe and classify different kinds of materials by their observable properties.', '2', v_ps1_id, 'Physical Sciences', 2),
    (v_ngss_fw_id, '2-PS1-2', 'Analyze data obtained from testing different materials to determine which materials have the properties that are best suited for an intended purpose.', '2', v_ps1_id, 'Physical Sciences', 3),
    (v_ngss_fw_id, '5-PS1-1', 'Develop a model to describe that matter is made of particles too small to be seen.', '5', v_ps1_id, 'Physical Sciences', 4),
    (v_ngss_fw_id, '5-PS1-2', 'Measure and graph quantities to provide evidence that regardless of the type of change that occurs when heating, cooling, or mixing substances, the total weight of matter is conserved.', '5', v_ps1_id, 'Physical Sciences', 5),
    (v_ngss_fw_id, 'MS-PS1-1', 'Develop models to describe the atomic composition of simple molecules and extended structures.', '6-8', v_ps1_id, 'Physical Sciences', 6),
    (v_ngss_fw_id, 'MS-PS1-2', 'Analyze and interpret data on the properties of substances before and after the substances interact to determine if a chemical reaction has occurred.', '6-8', v_ps1_id, 'Physical Sciences', 7);

    -- Life Sciences domain header
    INSERT INTO global_standards (id, framework_id, code, description, grade_level, domain, display_order)
    VALUES (v_ls1_id, v_ngss_fw_id, 'LS1', 'From Molecules to Organisms: Structures and Processes', NULL, 'Life Sciences', 2);

    INSERT INTO global_standards (framework_id, code, description, grade_level, parent_id, domain, display_order) VALUES
    (v_ngss_fw_id, 'K-LS1-1', 'Use observations to describe patterns of what plants and animals (including humans) need to survive.', 'K', v_ls1_id, 'Life Sciences', 1),
    (v_ngss_fw_id, '1-LS1-1', 'Use materials to design a solution to a human problem by mimicking how plants and/or animals use their external parts to help them survive, grow, and meet their needs.', '1', v_ls1_id, 'Life Sciences', 2),
    (v_ngss_fw_id, '3-LS1-1', 'Develop models to describe that organisms have unique and diverse life cycles but all have in common birth, growth, reproduction, and death.', '3', v_ls1_id, 'Life Sciences', 3),
    (v_ngss_fw_id, '4-LS1-1', 'Construct an argument that plants and animals have internal and external structures that function to support survival, growth, behavior, and reproduction.', '4', v_ls1_id, 'Life Sciences', 4),
    (v_ngss_fw_id, 'MS-LS1-1', 'Conduct an investigation to provide evidence that living things are made of cells; either one cell or many different numbers and types of cells.', '6-8', v_ls1_id, 'Life Sciences', 5),
    (v_ngss_fw_id, 'MS-LS1-2', 'Develop and use a model to describe the function of a cell as a whole and ways the parts of cells contribute to the function.', '6-8', v_ls1_id, 'Life Sciences', 6);

    -- Earth and Space Sciences domain header
    INSERT INTO global_standards (id, framework_id, code, description, grade_level, domain, display_order)
    VALUES (v_ess1_id, v_ngss_fw_id, 'ESS1', 'Earth''s Place in the Universe', NULL, 'Earth and Space Sciences', 3);

    INSERT INTO global_standards (framework_id, code, description, grade_level, parent_id, domain, display_order) VALUES
    (v_ngss_fw_id, 'K-ESS1-1', 'Use and share observations of local weather conditions to describe patterns over time.', 'K', v_ess1_id, 'Earth and Space Sciences', 1),
    (v_ngss_fw_id, '1-ESS1-1', 'Use observations of the sun, moon, and stars to describe patterns that can be predicted.', '1', v_ess1_id, 'Earth and Space Sciences', 2),
    (v_ngss_fw_id, '5-ESS1-1', 'Support an argument that differences in the apparent brightness of the sun compared to other stars is due to their relative distances from Earth.', '5', v_ess1_id, 'Earth and Space Sciences', 3),
    (v_ngss_fw_id, 'MS-ESS1-1', 'Develop and use a model of the Earth-sun-moon system to describe the cyclic patterns of lunar phases, eclipses of the sun and moon, and seasons.', '6-8', v_ess1_id, 'Earth and Space Sciences', 4);

    -- Engineering, Technology, and Applications of Science
    INSERT INTO global_standards (id, framework_id, code, description, grade_level, domain, display_order)
    VALUES (v_ets1_id, v_ngss_fw_id, 'ETS1', 'Engineering Design', NULL, 'Engineering', 4);

    INSERT INTO global_standards (framework_id, code, description, grade_level, parent_id, domain, display_order) VALUES
    (v_ngss_fw_id, 'K-2-ETS1-1', 'Ask questions, make observations, and gather information about a situation people want to change to define a simple problem that can be solved through the development of a new or improved object or tool.', 'K-2', v_ets1_id, 'Engineering', 1),
    (v_ngss_fw_id, 'K-2-ETS1-2', 'Develop a simple sketch, drawing, or physical model to illustrate how the shape of an object helps it function as needed to solve a given problem.', 'K-2', v_ets1_id, 'Engineering', 2),
    (v_ngss_fw_id, '3-5-ETS1-1', 'Define a simple design problem reflecting a need or a want that includes specified criteria for success and constraints on materials, time, or cost.', '3-5', v_ets1_id, 'Engineering', 3),
    (v_ngss_fw_id, '3-5-ETS1-2', 'Generate and compare multiple possible solutions to a problem based on how well each is likely to meet the criteria and constraints of the problem.', '3-5', v_ets1_id, 'Engineering', 4),
    (v_ngss_fw_id, 'MS-ETS1-1', 'Define the criteria and constraints of a design problem with sufficient precision to ensure a successful solution, taking into account relevant scientific principles and potential impacts on people and the natural environment that limit possible solutions.', '6-8', v_ets1_id, 'Engineering', 5);
  END IF;
END $$;

-- ============================================================
-- 3. Translation records — who initiated, when, for which student/framework
-- ============================================================

CREATE TABLE IF NOT EXISTS translation_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id           uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  target_framework_id uuid NOT NULL REFERENCES standards_frameworks(id) ON DELETE CASCADE,
  translated_by       uuid NOT NULL REFERENCES auth.users(id),
  reviewed            boolean NOT NULL DEFAULT false,
  reviewed_by         uuid REFERENCES auth.users(id),
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_records_student ON translation_records(student_id);
CREATE INDEX IF NOT EXISTS idx_translation_records_school ON translation_records(school_id);

-- ============================================================
-- 4. Translation mappings — individual skill→standard mappings
-- ============================================================

CREATE TABLE IF NOT EXISTS translation_mappings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id          uuid NOT NULL REFERENCES translation_records(id) ON DELETE CASCADE,
  -- Source: a competency score (from skill assessments or direct grading)
  competency_score_id     uuid REFERENCES competency_scores(id) ON DELETE SET NULL,
  -- Alternative source: a student skill assignment
  student_skill_assignment_id uuid REFERENCES student_skill_assignments(id) ON DELETE SET NULL,
  -- Target: a standard in the target framework
  standard_id             uuid NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
  confidence              real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  level_in_standard       text,
  human_override          boolean NOT NULL DEFAULT false,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_translation_mappings_translation ON translation_mappings(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_mappings_standard ON translation_mappings(standard_id);

-- ============================================================
-- 5. RLS policies for translation tables
--    Use direct role checks to avoid recursion
-- ============================================================

ALTER TABLE translation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_mappings ENABLE ROW LEVEL SECURITY;

-- Helper: check school membership without recursion
-- (reuse the pattern from other migrations — direct profiles lookup)

-- Translation records: school members can read, educators/admins can write
CREATE POLICY tr_select ON translation_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.school_id = translation_records.school_id
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tr_insert ON translation_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.school_id = translation_records.school_id
        AND profiles.role IN ('admin', 'educator')
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tr_update ON translation_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.school_id = translation_records.school_id
        AND profiles.role IN ('admin', 'educator')
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.school_id = translation_records.school_id
        AND profiles.role IN ('admin', 'educator')
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tr_delete ON translation_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.school_id = translation_records.school_id
        AND profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

-- Translation mappings: use direct school_id check via translation_records join
CREATE POLICY tm_select ON translation_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM translation_records tr
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = tr.school_id
      WHERE tr.id = translation_mappings.translation_id
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tm_insert ON translation_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM translation_records tr
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = tr.school_id AND p.role IN ('admin', 'educator')
      WHERE tr.id = translation_mappings.translation_id
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tm_update ON translation_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM translation_records tr
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = tr.school_id AND p.role IN ('admin', 'educator')
      WHERE tr.id = translation_mappings.translation_id
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM translation_records tr
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = tr.school_id AND p.role IN ('admin', 'educator')
      WHERE tr.id = translation_mappings.translation_id
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );

CREATE POLICY tm_delete ON translation_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM translation_records tr
      JOIN profiles p ON p.id = auth.uid() AND p.school_id = tr.school_id AND p.role = 'admin'
      WHERE tr.id = translation_mappings.translation_id
    )
    OR EXISTS (
      SELECT 1 FROM system_admins WHERE user_id = auth.uid()
    )
  );
