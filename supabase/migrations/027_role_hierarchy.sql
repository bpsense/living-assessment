-- 027_role_hierarchy.sql
-- Implements the 6-tier role hierarchy:
--   6 = System Admin  (junction: system_admins)
--   5 = School Admin   (role = 'admin')
--   4 = Department Admin (role = 'educator' + junction: department_admins)
--   3 = Educator       (role = 'educator')
--   2 = Family/Parent  (role = 'parent')
--   1 = Learner        (role = 'learner')
--
-- Also adds: is_active soft-deactivation, student_id link on profiles,
-- auth_access_level() helper, and learner-scoped RLS policies.

-- ============================================================
-- 1. Expand user_role enum with 'learner'
-- ============================================================

alter type user_role add value if not exists 'learner';

-- ============================================================
-- 2. Add student_id to profiles (links learner auth → student record)
-- ============================================================

alter table profiles add column if not exists student_id uuid references students(id) on delete set null;
create unique index if not exists idx_profiles_student_id on profiles(student_id) where student_id is not null;

-- ============================================================
-- 3. Add is_active for soft deactivation
-- ============================================================

alter table profiles add column if not exists is_active boolean not null default true;

-- ============================================================
-- 4. auth_access_level() — returns numeric hierarchy level
-- ============================================================

create or replace function auth_access_level()
returns int as $$
declare
  v_role user_role;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return 0; end if;

  -- System admin = 6
  if exists (select 1 from system_admins where user_id = v_uid) then
    return 6;
  end if;

  select role into v_role from profiles where id = v_uid;

  -- School admin = 5
  if v_role = 'admin' then return 5; end if;

  -- Educator: department admin = 4, regular = 3
  if v_role = 'educator' then
    if exists (select 1 from department_admins where user_id = v_uid) then
      return 4;
    end if;
    return 3;
  end if;

  -- Family = 2
  if v_role = 'parent' then return 2; end if;

  -- Learner = 1
  if v_role = 'learner' then return 1; end if;

  return 0;
end;
$$ language plpgsql stable security definer;

-- ============================================================
-- 5. Learner RLS policies
-- ============================================================

-- Learners can see their own profile
create policy "profiles_select_learner"
  on profiles for select
  using (
    auth_access_level() = 1
    and id = auth.uid()
  );

-- Learners can see their own student record
create policy "students_select_learner"
  on students for select
  using (
    auth_access_level() = 1
    and id = (select student_id from profiles where id = auth.uid())
  );

-- Learners can see observations about themselves
create policy "observations_select_learner"
  on observations for select
  using (
    auth_access_level() = 1
    and student_id = (select student_id from profiles where id = auth.uid())
  );

-- Learners can see dimensions (needed to understand observations)
create policy "dimensions_select_learner"
  on dimensions for select
  using (
    auth_access_level() = 1
    and school_id = (select school_id from profiles where id = auth.uid())
    and is_active = true
  );

-- Learners can see their school's basic info
create policy "schools_select_learner"
  on schools for select
  using (
    auth_access_level() = 1
    and id = (select school_id from profiles where id = auth.uid())
  );

-- ============================================================
-- 6. Deactivation: update profile RLS to respect is_active
--    (admins+ can still see inactive users for management)
-- ============================================================

-- Note: We don't modify existing SELECT policies since admins need to
-- see inactive users. Instead, we'll filter in the application layer
-- and add a helper function.

create or replace function is_user_active(p_user_id uuid)
returns boolean as $$
  select coalesce(
    (select is_active from profiles where id = p_user_id),
    false
  );
$$ language sql stable security definer;
