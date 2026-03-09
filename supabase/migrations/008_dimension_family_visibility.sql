-- 008_dimension_family_visibility.sql
-- Add a boolean flag to control which dimensions are visible to family users.
-- Defaults to TRUE so existing dimensions remain visible.

ALTER TABLE dimensions
  ADD COLUMN IF NOT EXISTS visible_to_family BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN dimensions.visible_to_family IS
  'When FALSE, this dimension is hidden from the family (parent) dashboard and student profile view.';
