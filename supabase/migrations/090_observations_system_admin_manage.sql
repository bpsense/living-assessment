-- 090_observations_system_admin_manage.sql
-- Closes the originally-reported bug: a system admin could VIEW observations across
-- schools (observations_select_system_admin) but had no write policy, so saving an
-- observation for any student outside their own school failed RLS. Every other write
-- table already has a *_manage_system_admin policy (see students_manage_system_admin
-- in 021_system_admin.sql); observations was simply missed.
create policy "observations_manage_system_admin"
  on observations for all
  using (is_system_admin())
  with check (is_system_admin());
