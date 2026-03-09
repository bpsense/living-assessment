-- 002_rls_policies.sql
-- Row Level Security policies for all tables.
-- Kept separate from schema for maintainability.

-- ============================================================
-- Helper: get the current user's school_id from their profile
-- ============================================================
create or replace function auth_school_id()
returns uuid as $$
  select school_id from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- Helper: get the current user's role
create or replace function auth_role()
returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
alter table schools              enable row level security;
alter table profiles             enable row level security;
alter table classrooms           enable row level security;
alter table educator_classrooms  enable row level security;
alter table students             enable row level security;
alter table parent_students      enable row level security;
alter table dimensions           enable row level security;
alter table observations         enable row level security;
alter table interest_surveys     enable row level security;
alter table standards_frameworks enable row level security;
alter table standards            enable row level security;
alter table dimension_standards  enable row level security;
alter table student_sessions     enable row level security;

-- ============================================================
-- schools
-- ============================================================
-- Everyone can see their own school
create policy "schools_select_own"
  on schools for select
  using (id = auth_school_id());

-- Admins can update their own school
create policy "schools_update_admin"
  on schools for update
  using (id = auth_school_id() and auth_role() = 'admin')
  with check (id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- profiles
-- ============================================================
-- Users can see profiles in their school
create policy "profiles_select_school"
  on profiles for select
  using (school_id = auth_school_id());

-- Users can update their own profile
create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can insert profiles for their school
create policy "profiles_insert_admin"
  on profiles for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- classrooms
-- ============================================================
-- Users can see classrooms in their school
create policy "classrooms_select_school"
  on classrooms for select
  using (school_id = auth_school_id());

-- Admins and educators can manage classrooms
create policy "classrooms_insert"
  on classrooms for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "classrooms_update"
  on classrooms for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "classrooms_delete_admin"
  on classrooms for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- educator_classrooms
-- ============================================================
create policy "educator_classrooms_select_school"
  on educator_classrooms for select
  using (school_id = auth_school_id());

create policy "educator_classrooms_insert_admin"
  on educator_classrooms for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "educator_classrooms_delete_admin"
  on educator_classrooms for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- students
-- ============================================================
-- Educators and admins see students in their school
create policy "students_select_educator"
  on students for select
  using (
    school_id = auth_school_id()
    and auth_role() in ('admin', 'educator')
  );

-- Parents can only see their linked students
create policy "students_select_parent"
  on students for select
  using (
    auth_role() = 'parent'
    and id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Educators and admins can manage students
create policy "students_insert"
  on students for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "students_update"
  on students for update
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'))
  with check (school_id = auth_school_id());

create policy "students_delete_admin"
  on students for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- parent_students
-- ============================================================
create policy "parent_students_select_school"
  on parent_students for select
  using (school_id = auth_school_id());

create policy "parent_students_insert_admin"
  on parent_students for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "parent_students_delete_admin"
  on parent_students for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- dimensions
-- ============================================================
-- Educators and parents can SELECT in their school
create policy "dimensions_select_school"
  on dimensions for select
  using (school_id = auth_school_id());

-- Admins can INSERT/UPDATE/DELETE
create policy "dimensions_insert_admin"
  on dimensions for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "dimensions_update_admin"
  on dimensions for update
  using (school_id = auth_school_id() and auth_role() = 'admin')
  with check (school_id = auth_school_id());

create policy "dimensions_delete_admin"
  on dimensions for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- observations
-- ============================================================
-- Educators can see observations in their school
create policy "observations_select_educator"
  on observations for select
  using (
    school_id = auth_school_id()
    and auth_role() in ('admin', 'educator')
  );

-- Parents can only see observations for their linked students
create policy "observations_select_parent"
  on observations for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Educators can insert observations for students in their school
create policy "observations_insert_educator"
  on observations for insert
  with check (
    school_id = auth_school_id()
    and auth_role() in ('admin', 'educator')
    and observer_id = auth.uid()
  );

-- Educators can update their own observations
create policy "observations_update_educator"
  on observations for update
  using (
    school_id = auth_school_id()
    and auth_role() in ('admin', 'educator')
    and observer_id = auth.uid()
  )
  with check (school_id = auth_school_id());

-- Admins can delete observations in their school
create policy "observations_delete_admin"
  on observations for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- interest_surveys
-- ============================================================
-- Educators and admins can see surveys in their school
create policy "interest_surveys_select_staff"
  on interest_surveys for select
  using (
    school_id = auth_school_id()
    and auth_role() in ('admin', 'educator')
  );

-- Parents can see surveys for their linked students
create policy "interest_surveys_select_parent"
  on interest_surveys for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Student sessions can insert surveys (via service role or special RPC)
-- This policy allows any authenticated user with school access to insert,
-- but the student session mechanism uses a service-role RPC to insert
-- on behalf of the student.
create policy "interest_surveys_insert_session"
  on interest_surveys for insert
  with check (school_id = auth_school_id());

-- ============================================================
-- standards_frameworks
-- ============================================================
-- All authenticated users in the school can SELECT
create policy "standards_frameworks_select"
  on standards_frameworks for select
  using (school_id = auth_school_id());

-- Admins can manage
create policy "standards_frameworks_insert_admin"
  on standards_frameworks for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "standards_frameworks_update_admin"
  on standards_frameworks for update
  using (school_id = auth_school_id() and auth_role() = 'admin')
  with check (school_id = auth_school_id());

create policy "standards_frameworks_delete_admin"
  on standards_frameworks for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- standards
-- ============================================================
-- All authenticated users in the school can SELECT
create policy "standards_select"
  on standards for select
  using (school_id = auth_school_id());

-- Admins can manage
create policy "standards_insert_admin"
  on standards for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "standards_update_admin"
  on standards for update
  using (school_id = auth_school_id() and auth_role() = 'admin')
  with check (school_id = auth_school_id());

create policy "standards_delete_admin"
  on standards for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- dimension_standards
-- ============================================================
create policy "dimension_standards_select"
  on dimension_standards for select
  using (school_id = auth_school_id());

create policy "dimension_standards_insert_admin"
  on dimension_standards for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "dimension_standards_delete_admin"
  on dimension_standards for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');

-- ============================================================
-- student_sessions
-- ============================================================
-- Educators can see and create sessions in their school
create policy "student_sessions_select_educator"
  on student_sessions for select
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "student_sessions_insert_educator"
  on student_sessions for insert
  with check (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));

create policy "student_sessions_delete_educator"
  on student_sessions for delete
  using (school_id = auth_school_id() and auth_role() in ('admin', 'educator'));
