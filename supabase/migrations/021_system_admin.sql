-- 021_system_admin.sql
-- Adds system admin capability for multi-school platform management.
-- System admins can view and manage all schools without modifying the existing user_role enum.

-- ============================================================
-- 1. System admins table
-- ============================================================

create table system_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

alter table system_admins enable row level security;

-- Only system admins can see/manage system_admins
create policy "system_admins_select"
  on system_admins for select
  using (auth.uid() in (select user_id from system_admins));

create policy "system_admins_insert"
  on system_admins for insert
  with check (auth.uid() in (select user_id from system_admins));

create policy "system_admins_delete"
  on system_admins for delete
  using (auth.uid() in (select user_id from system_admins));

-- ============================================================
-- 2. Helper function: check if current user is a system admin
-- ============================================================

create or replace function is_system_admin()
returns boolean as $$
  select exists (
    select 1 from system_admins where user_id = auth.uid()
  );
$$ language sql stable security definer;

-- ============================================================
-- 3. RLS policies for system admin cross-school access
-- ============================================================

-- System admins can see ALL schools
create policy "schools_select_system_admin"
  on schools for select
  using (is_system_admin());

create policy "schools_update_system_admin"
  on schools for update
  using (is_system_admin())
  with check (is_system_admin());

create policy "schools_insert_system_admin"
  on schools for insert
  with check (is_system_admin());

-- System admins can see profiles across all schools
create policy "profiles_select_system_admin"
  on profiles for select
  using (is_system_admin());

-- System admins can manage profiles across all schools
create policy "profiles_insert_system_admin"
  on profiles for insert
  with check (is_system_admin());

create policy "profiles_update_system_admin"
  on profiles for update
  using (is_system_admin());

-- System admins can see all classrooms
create policy "classrooms_select_system_admin"
  on classrooms for select
  using (is_system_admin());

create policy "classrooms_manage_system_admin"
  on classrooms for all
  using (is_system_admin())
  with check (is_system_admin());

-- System admins can see all students
create policy "students_select_system_admin"
  on students for select
  using (is_system_admin());

create policy "students_manage_system_admin"
  on students for all
  using (is_system_admin())
  with check (is_system_admin());

-- System admins can see all observations
create policy "observations_select_system_admin"
  on observations for select
  using (is_system_admin());

-- System admins can see all dimensions
create policy "dimensions_select_system_admin"
  on dimensions for select
  using (is_system_admin());

create policy "dimensions_manage_system_admin"
  on dimensions for all
  using (is_system_admin())
  with check (is_system_admin());

-- System admins can see educator_classrooms
create policy "educator_classrooms_select_system_admin"
  on educator_classrooms for select
  using (is_system_admin());

-- System admins can see parent_students
create policy "parent_students_select_system_admin"
  on parent_students for select
  using (is_system_admin());

-- System admins can see standards
create policy "standards_frameworks_select_system_admin"
  on standards_frameworks for select
  using (is_system_admin());

create policy "standards_select_system_admin"
  on standards for select
  using (is_system_admin());

-- ============================================================
-- 4. Seed: promote the first admin user to system admin
-- ============================================================

insert into system_admins (user_id)
select id from profiles where role = 'admin' limit 1
on conflict do nothing;
