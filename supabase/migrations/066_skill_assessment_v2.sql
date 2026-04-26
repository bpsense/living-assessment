-- 066_skill_assessment_v2.sql
-- Phase 4 of the V2 refactor: unified skill assignment + assessment pipeline.
--
-- Renames the V1 skill_assignments / student_skill_assignments tables out of
-- the way (they keep working as `legacy_*`), then introduces:
--   * student_skill_assignments — per-student skill records with a `source`
--     ('project' | 'standalone') and an optional source_assignment_id.
--   * skill_assessments — Emerging/Developing/Achieving/Exceeding ratings
--     stamped against a student+skill, optionally tied to a student_skill_assignment.
--
-- assignment_skills already exists (migration 032). It's left untouched.
--
-- The V1 grading UI (SkillGrading.tsx, SkillAssignmentFlow.tsx) keeps working
-- against the renamed tables; src/lib/skill-assignment-data.ts is updated to
-- query `legacy_*`. The V2 pipeline lives behind new src/lib modules.

-- ============================================================
-- 1. Rename V1 tables (FKs from competency_scores follow automatically).
-- ============================================================

alter table if exists skill_assignments
  rename to legacy_skill_assignments;

alter table if exists student_skill_assignments
  rename to legacy_student_skill_assignments;

-- ============================================================
-- 2. assignment_skills already exists from 032 — assert and add a domain
--    convenience index for the new domain-aware UIs.
-- ============================================================

create table if not exists assignment_skills (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  skill_id      uuid not null references skills(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, skill_id)
);

-- ============================================================
-- 3. V2 student_skill_assignments
-- ============================================================
--
-- Per-student skill records. Created either:
--   * source = 'project'     when a project (assignments row) is assigned to
--                            students and the project has tagged skills, OR
--   * source = 'standalone'  when an educator assigns a skill directly from
--                            a student profile.

create table if not exists student_skill_assignments (
  id                    uuid primary key default gen_random_uuid(),
  student_id            uuid not null references students(id) on delete cascade,
  skill_id              uuid not null references skills(id) on delete cascade,
  assigned_by           uuid not null references profiles(id),
  assigned_at           timestamptz not null default now(),
  source                text not null check (source in ('project', 'standalone')),
  source_assignment_id  uuid references assignments(id) on delete set null,
  status                text not null default 'active'
                          check (status in ('active', 'completed', 'dropped')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_ssa_v2_student        on student_skill_assignments(student_id);
create index if not exists idx_ssa_v2_skill          on student_skill_assignments(skill_id);
create index if not exists idx_ssa_v2_status         on student_skill_assignments(student_id, status);
create index if not exists idx_ssa_v2_source_proj    on student_skill_assignments(source_assignment_id)
  where source_assignment_id is not null;

-- Don't double-assign the same student/skill from the same source twice.
-- (A student can re-take the same skill via a different project, but the
-- combination of student+skill+source_assignment_id should be unique.)
create unique index if not exists uq_ssa_v2_student_skill_project
  on student_skill_assignments(student_id, skill_id, source_assignment_id)
  where source = 'project' and source_assignment_id is not null;

create trigger set_student_skill_assignments_v2_updated_at
  before update on student_skill_assignments
  for each row execute function set_updated_at();

-- ============================================================
-- 4. skill_assessments
-- ============================================================
--
-- Emerging/Developing/Achieving/Exceeding ratings. Append-only history;
-- "current level" is derived from the latest assessment per (student, skill).

create table if not exists skill_assessments (
  id                          uuid primary key default gen_random_uuid(),
  student_id                  uuid not null references students(id) on delete cascade,
  skill_id                    uuid not null references skills(id) on delete cascade,
  assessed_by                 uuid not null references profiles(id),
  level                       text not null check (level in (
                                'emerging', 'developing', 'achieving', 'exceeding'
                              )),
  notes                       text,
  assessed_at                 timestamptz not null default now(),
  student_skill_assignment_id uuid references student_skill_assignments(id) on delete set null,
  created_at                  timestamptz not null default now()
);

create index if not exists idx_sa_student        on skill_assessments(student_id);
create index if not exists idx_sa_student_skill  on skill_assessments(student_id, skill_id, assessed_at desc);
create index if not exists idx_sa_skill          on skill_assessments(skill_id);
create index if not exists idx_sa_ssa            on skill_assessments(student_skill_assignment_id)
  where student_skill_assignment_id is not null;

-- ============================================================
-- 5. RLS — educators can read/write rows for students in their classrooms;
--    school admins everywhere in their school; system admins everywhere.
-- ============================================================

alter table student_skill_assignments enable row level security;
alter table skill_assessments enable row level security;

-- Visibility helper: a student is "visible to me" if I'm a system admin,
-- a school admin (own school), an educator with a row in educator_classrooms
-- joining the student's classroom, or the student/parent themselves.
--
-- The simplest formulation that matches the codebase pattern is to scope by
-- the student's school + the user's role; tighter educator-classroom scoping
-- can layer on top. For now we use: same-school admin/educator OR sysadmin.

create policy "ssa_v2_select"
  on student_skill_assignments for select to authenticated
  using (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "ssa_v2_insert"
  on student_skill_assignments for insert to authenticated
  with check (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "ssa_v2_update"
  on student_skill_assignments for update to authenticated
  using (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "ssa_v2_delete"
  on student_skill_assignments for delete to authenticated
  using (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "skill_assessments_select"
  on skill_assessments for select to authenticated
  using (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "skill_assessments_insert"
  on skill_assessments for insert to authenticated
  with check (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

-- Assessments are append-only; updates reserved for the original assessor
-- correcting their own row, or admins.
create policy "skill_assessments_update"
  on skill_assessments for update to authenticated
  using (
    is_system_admin()
    or assessed_by = auth.uid()
    or student_id in (
      select s.id from students s
      where s.school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

create policy "skill_assessments_delete"
  on skill_assessments for delete to authenticated
  using (
    is_system_admin()
    or student_id in (
      select s.id from students s
      where s.school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );
