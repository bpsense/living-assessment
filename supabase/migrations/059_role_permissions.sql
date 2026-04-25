-- 059_role_permissions.sql
-- Per-role, per-school configuration for sidebar visibility and page-level
-- view/edit toggles. Backs the school-admin-controlled permissions matrix.
--
-- Enforcement model:
--   - HARD role rules (admin/educator/parent/learner) stay in RLS as before.
--   - SOFT preferences (which sidebar items show, view-only vs edit) live
--     here and are read client-side. This table is a UI-policy store, not a
--     security boundary.
--
-- Default behavior (no rows): every sidebar item falls back to the catalog's
-- defaultAccess in src/lib/sidebar-catalog.ts, which preserves today's
-- hardcoded UI exactly.

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'educator', 'parent', 'learner')),
  sidebar_key text NOT NULL,
  access text NOT NULL CHECK (access IN ('hidden', 'view', 'edit')),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, role, sidebar_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_school_role
  ON public.role_permissions(school_id, role);

-- Touch updated_at on update
CREATE OR REPLACE FUNCTION public.touch_role_permission_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_role_permission ON public.role_permissions;
CREATE TRIGGER trg_touch_role_permission
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_role_permission_updated_at();

-- ============================================================
-- 2. RLS
-- ============================================================

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- School admins can manage all rows for their school
CREATE POLICY rp_admin_all ON public.role_permissions
  FOR ALL TO authenticated
  USING (
    school_id IN (
      SELECT p.school_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid())
  )
  WITH CHECK (
    school_id IN (
      SELECT p.school_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM public.system_admins sa WHERE sa.user_id = auth.uid())
  );

-- Anyone can SELECT the rows that govern their own role within their school —
-- they need to know what they can see.
CREATE POLICY rp_self_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    school_id IN (
      SELECT p.school_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = role_permissions.role
    )
  );
