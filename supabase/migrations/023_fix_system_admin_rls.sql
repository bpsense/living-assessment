-- 023_fix_system_admin_rls.sql
-- Fix infinite recursion in system_admins RLS policies.
-- The original policies referenced the system_admins table directly in their
-- USING clause, which caused the RLS check to recurse into itself.
-- Fix: use the is_system_admin() function which is SECURITY DEFINER and
-- bypasses RLS.

-- Drop the broken policies
drop policy if exists "system_admins_select" on system_admins;
drop policy if exists "system_admins_insert" on system_admins;
drop policy if exists "system_admins_delete" on system_admins;

-- Recreate using is_system_admin() which bypasses RLS via security definer
create policy "system_admins_select"
  on system_admins for select
  using (is_system_admin());

create policy "system_admins_insert"
  on system_admins for insert
  with check (is_system_admin());

create policy "system_admins_delete"
  on system_admins for delete
  using (is_system_admin());
