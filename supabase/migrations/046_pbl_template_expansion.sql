-- 046_pbl_template_expansion.sql
-- Expand assignment_templates into a full PBL project template system
-- with Gold Standard PBL design elements, phases, choice points, and
-- differentiation support.

-- ============================================================
-- New columns
-- ============================================================

ALTER TABLE assignment_templates
  ADD COLUMN IF NOT EXISTS grade_band text DEFAULT 'elementary',
  ADD COLUMN IF NOT EXISTS subject_area text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_duration_days integer,
  ADD COLUMN IF NOT EXISTS driving_question text,
  ADD COLUMN IF NOT EXISTS essential_understandings text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS authenticity_hook text,
  ADD COLUMN IF NOT EXISTS final_product jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dok_level integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS phases jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS choice_points jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS critique_protocol text,
  ADD COLUMN IF NOT EXISTS scaffolding_notes text,
  ADD COLUMN IF NOT EXISTS differentiation jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS materials_and_resources jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES assignment_templates(id),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- ============================================================
-- Check constraints
-- ============================================================

ALTER TABLE assignment_templates
  ADD CONSTRAINT valid_grade_band CHECK (grade_band IN ('early_elementary', 'elementary', 'upper_elementary', 'middle_school', 'mixed')),
  ADD CONSTRAINT valid_dok CHECK (dok_level BETWEEN 1 AND 4),
  ADD CONSTRAINT valid_template_status CHECK (status IN ('draft', 'published', 'archived'));

-- ============================================================
-- Indexes for browsing/filtering
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_templates_grade_band ON assignment_templates(grade_band);
CREATE INDEX IF NOT EXISTS idx_templates_status ON assignment_templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON assignment_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_templates_subject ON assignment_templates USING gin(subject_area);

-- ============================================================
-- Assignments: add template link and project data
-- ============================================================

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES assignment_templates(id),
  ADD COLUMN IF NOT EXISTS project_data jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_assignments_template ON assignments(template_id);

-- ============================================================
-- Table comment
-- ============================================================

COMMENT ON TABLE assignment_templates IS 'PBL project templates with Gold Standard design elements';
