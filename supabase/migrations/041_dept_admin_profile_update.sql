-- 041_dept_admin_profile_update.sql
-- Allow department admins (access level 4+) to update profiles in their school.
-- Previously only school admins (level 5+) could update other users' profiles,
-- preventing dept admins from linking learner profiles to student records.

CREATE POLICY "profiles_update_dept_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_access_level() >= 4
  )
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_access_level() >= 4
  );
