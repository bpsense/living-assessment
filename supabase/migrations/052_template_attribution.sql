-- ============================================================
-- 052: Template attribution — track original creator lineage
-- ============================================================
-- When a template is duplicated, we need to show:
--   "Original project by [X], adapted by [Y]"
-- This column stores the ID of the root original template,
-- avoiding recursive lookups through parent_template_id chains.
-- ============================================================

ALTER TABLE assignment_templates
  ADD COLUMN IF NOT EXISTS original_template_id uuid
    REFERENCES assignment_templates(id);

CREATE INDEX IF NOT EXISTS idx_templates_original
  ON assignment_templates(original_template_id)
  WHERE original_template_id IS NOT NULL;

-- Backfill: for existing copies, point to their parent as original
UPDATE assignment_templates
SET original_template_id = parent_template_id
WHERE parent_template_id IS NOT NULL
  AND original_template_id IS NULL;
