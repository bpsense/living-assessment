-- 060_role_permissions_dept_admin.sql
-- Add 'dept_admin' as an effective role in the permissions matrix.
--
-- Department/Location admins are role='educator' + a row in
-- public.department_admins; they sit between regular educators and the
-- school admin in the access tier (level 4 vs 3). The permissions UI
-- needs to address them as a separate column so school admins can grant
-- elevated access to them without elevating every educator.
--
-- Storage stays in the same role_permissions table — only the CHECK
-- constraint is widened.

ALTER TABLE public.role_permissions
  DROP CONSTRAINT IF EXISTS role_permissions_role_check;

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_role_check
  CHECK (role IN ('admin', 'dept_admin', 'educator', 'parent', 'learner'));

-- The rp_self_select policy joined role_permissions.role against
-- profiles.role. Dept admin rows wouldn't match because dept admins still
-- have profiles.role = 'educator'. Replace with a policy that also matches
-- dept_admin rows when the user is in department_admins.

DROP POLICY IF EXISTS rp_self_select ON public.role_permissions;
CREATE POLICY rp_self_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    -- Match by their own DB role (admin / educator / parent / learner)
    school_id IN (
      SELECT p.school_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = role_permissions.role
    )
    OR
    -- Dept admins additionally see dept_admin rows in their school
    (
      role_permissions.role = 'dept_admin'
      AND school_id IN (
        SELECT da.school_id
        FROM public.department_admins da
        WHERE da.user_id = auth.uid()
      )
    )
  );
