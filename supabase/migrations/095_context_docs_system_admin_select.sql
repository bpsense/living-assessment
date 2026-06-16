-- 095_context_docs_system_admin_select.sql
-- Fix: system admins could not view a learner's compiled context document.
--
-- `compile_student_context` (SECURITY DEFINER) writes student_context_documents as
-- the table owner (RLS-exempt), so the compile RPC succeeds. But the client then
-- reads the row back with a plain authenticated SELECT, which is gated by RLS. The
-- existing policies only allow same-school admin/educator staff (context_docs_select_staff)
-- or a linked parent (context_docs_select_parent) — there is no is_system_admin()
-- bypass, unlike nearly every other table. A system admin viewing a learner outside
-- their own profile's school therefore gets 0 rows on the post-compile fetch, which
-- surfaces in the UI as "Failed to compile context".
--
-- Add an additive system-admin SELECT policy (RLS policies are OR'd), matching the
-- is_system_admin() pattern used across the schema. Read-only: writes already work via
-- the SECURITY DEFINER compile function, so no INSERT/UPDATE policy is needed here.

DROP POLICY IF EXISTS "context_docs_select_system_admin" ON public.student_context_documents;
CREATE POLICY "context_docs_select_system_admin"
  ON public.student_context_documents FOR SELECT TO authenticated
  USING (is_system_admin());
