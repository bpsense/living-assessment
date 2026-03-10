-- 022_departments.sql
-- Adds departments/locations as organizational units within schools.
-- Classrooms can be assigned to a department for scoped admin views.

-- ============================================================
-- 1. Departments table
-- ============================================================

create table departments (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, name)
);

create index idx_departments_school_id on departments(school_id);

alter table departments enable row level security;

-- All school members can see their school's departments
create policy "departments_select_school"
  on departments for select
  using (school_id = auth_school_id() or is_system_admin());

-- School admins and system admins can manage departments
create policy "departments_insert_admin"
  on departments for insert
  with check (
    (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  );

create policy "departments_update_admin"
  on departments for update
  using (
    (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  )
  with check (
    (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  );

create policy "departments_delete_admin"
  on departments for delete
  using (
    (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  );

-- ============================================================
-- 2. Add department_id to classrooms
-- ============================================================

alter table classrooms add column department_id uuid references departments(id) on delete set null;
create index idx_classrooms_department_id on classrooms(department_id);

-- ============================================================
-- 3. Department admins junction table
-- ============================================================

create table department_admins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  department_id   uuid not null references departments(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, department_id)
);

create index idx_department_admins_user on department_admins(user_id);
create index idx_department_admins_dept on department_admins(department_id);

alter table department_admins enable row level security;

-- School admins and system admins can see/manage department admins
create policy "department_admins_select"
  on department_admins for select
  using (
    user_id = auth.uid()
    or (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  );

create policy "department_admins_insert"
  on department_admins for insert
  with check (
    (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  );

create policy "department_admins_delete"
  on department_admins for delete
  using (
    (school_id = auth_school_id() and auth_role() = 'admin')
    or is_system_admin()
  );

-- ============================================================
-- 4. Helper: get department IDs for current user
-- ============================================================

create or replace function auth_department_ids()
returns uuid[] as $$
  select coalesce(
    array_agg(department_id),
    '{}'::uuid[]
  )
  from department_admins
  where user_id = auth.uid();
$$ language sql stable security definer;
