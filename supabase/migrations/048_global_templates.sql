-- ============================================================
-- 048: Global Templates — system-wide template visibility
-- ============================================================
-- Adds is_global flag to assignment_templates so system admins
-- can publish templates visible to ALL schools automatically.
-- ============================================================

-- 1. Add the is_global column
ALTER TABLE assignment_templates
  ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Partial index for efficient lookup of global templates
CREATE INDEX IF NOT EXISTS idx_templates_is_global
  ON assignment_templates(is_global) WHERE is_global = true;

-- 2. Replace the select RLS policy to include global templates
DROP POLICY IF EXISTS "assignment_templates_select" ON assignment_templates;

CREATE POLICY "assignment_templates_select"
  ON assignment_templates FOR SELECT
  USING (
    -- Global shared templates are visible to ALL authenticated users
    (is_global = true AND is_shared = true)
    OR
    -- School-scoped templates: same as original logic
    (
      school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
      AND (is_shared = true OR created_by = auth.uid())
    )
  );

-- 3. Mark existing seed templates as global (before trigger is created)
UPDATE assignment_templates
SET is_global = true
WHERE school_id = 'a0000000-0000-4000-8000-000000000001'
  AND status = 'published';

-- 4. Trigger to enforce only system admins can set is_global = true
-- Uses SECURITY DEFINER and checks current_setting to allow migrations/superuser bypass
CREATE OR REPLACE FUNCTION enforce_global_template_permission()
RETURNS trigger AS $$
BEGIN
  -- Allow superuser and migration contexts (no auth.uid available)
  IF current_setting('role', true) = 'postgres'
     OR current_setting('request.jwt.claims', true) IS NULL
     OR current_setting('request.jwt.claims', true) = '' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_global = true AND NOT is_system_admin() THEN
    RAISE EXCEPTION 'Only system administrators can create global templates';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_global_template_permission ON assignment_templates;

CREATE TRIGGER check_global_template_permission
  BEFORE INSERT OR UPDATE ON assignment_templates
  FOR EACH ROW
  WHEN (NEW.is_global = true)
  EXECUTE FUNCTION enforce_global_template_permission();
