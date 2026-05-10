-- 077_standards_driven_assignments.sql
-- Phase 1 of the standards-driven assignment refactor.
--
-- Wires assignments to the school's `standards` tree (the Boundless
-- Developmental Skill Baseline framework) instead of `competencies`,
-- so that every per-(student × standard) assessment rolls up directly
-- through `dimension_standards` to the amoeba dimensions.
--
-- Snapshot-on-assign semantics: when a student is added to an
-- assignment, the parent's title/description/standards are copied into
-- the student row. Future edits to the parent do NOT propagate to
-- already-assigned students. Editing a student's snapshot is the
-- "personalize" action.
--
-- Append-only assessments: each assessment writes a new row. Latest
-- per (student × standard) is "current"; the full series powers timeline
-- playback in the amoeba.
--
-- Old paths (assignment_competencies, student_skill_assignments,
-- skill_assessments, observations) are NOT touched. They will be
-- retired in a later migration once the new pipeline ships.

-- ============================================================
-- 1. assignment_standards  (parent assignment ↔ standards picker)
-- ============================================================

create table if not exists assignment_standards (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references assignments(id) on delete cascade,
  standard_id     uuid not null references standards(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (assignment_id, standard_id)
);

create index if not exists idx_assignment_standards_assignment
  on assignment_standards(assignment_id);
create index if not exists idx_assignment_standards_standard
  on assignment_standards(standard_id);

-- ============================================================
-- 2. student_assignments  — add personalization snapshot columns
-- ============================================================

alter table student_assignments
  add column if not exists personalized_title       text,
  add column if not exists personalized_description text;

-- ============================================================
-- 3. student_assignment_standards  (per-student snapshot of standards)
--    Populated at assign time as a copy of assignment_standards.
--    Editing rows here = personalizing for that one student.
-- ============================================================

create table if not exists student_assignment_standards (
  id                      uuid primary key default gen_random_uuid(),
  student_assignment_id   uuid not null references student_assignments(id) on delete cascade,
  standard_id             uuid not null references standards(id) on delete cascade,
  created_at              timestamptz not null default now(),
  unique (student_assignment_id, standard_id)
);

create index if not exists idx_sas_student_assignment
  on student_assignment_standards(student_assignment_id);
create index if not exists idx_sas_standard
  on student_assignment_standards(standard_id);

-- ============================================================
-- 4. assignment_standard_assessments  (append-only ratings)
--    One row per recorded rating. Latest per (student_id, standard_id)
--    is the "current" score; full series feeds amoeba timeline.
-- ============================================================

do $$ begin
  create type assessment_level as enum ('emerging','developing','achieving','mastery');
exception when duplicate_object then null; end $$;

create table if not exists assignment_standard_assessments (
  id                      uuid primary key default gen_random_uuid(),
  student_assignment_id   uuid not null references student_assignments(id) on delete cascade,
  student_id              uuid not null references students(id) on delete cascade,
  school_id               uuid not null references schools(id) on delete cascade,
  standard_id             uuid not null references standards(id) on delete cascade,
  level                   assessment_level not null,
  notes                   text,
  assessor_id             uuid not null references profiles(id),
  assessed_at             timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

create index if not exists idx_asa_student          on assignment_standard_assessments(student_id);
create index if not exists idx_asa_school           on assignment_standard_assessments(school_id);
create index if not exists idx_asa_standard         on assignment_standard_assessments(standard_id);
create index if not exists idx_asa_assessed_at     on assignment_standard_assessments(assessed_at);
-- For "latest per (student, standard)" lookup
create index if not exists idx_asa_student_standard_time
  on assignment_standard_assessments(student_id, standard_id, assessed_at desc);

-- ============================================================
-- 5. standards.visible_to_family  (per-standard family-view filter)
-- ============================================================

alter table standards
  add column if not exists visible_to_family boolean not null default true;

-- ============================================================
-- 6. assignment_attachments  (assignment-level files; visible to all assigned)
-- ============================================================

create table if not exists assignment_attachments (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references assignments(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  file_path       text not null,           -- storage object path within the bucket
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_assignment_attachments_assignment
  on assignment_attachments(assignment_id);

-- ============================================================
-- 7. assessment_attachments  (per-student-per-assessment files)
-- ============================================================

create table if not exists assessment_attachments (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references assignment_standard_assessments(id) on delete cascade,
  school_id       uuid not null references schools(id) on delete cascade,
  file_path       text not null,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid not null references profiles(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_assessment_attachments_assessment
  on assessment_attachments(assessment_id);

-- ============================================================
-- RLS — same school-scoped pattern used elsewhere in this codebase.
-- Educators in the school can read/write; parents can read rows for
-- their child(ren) only and only standards visible_to_family = true.
-- System admins always pass.
-- ============================================================

alter table assignment_standards               enable row level security;
alter table student_assignment_standards       enable row level security;
alter table assignment_standard_assessments    enable row level security;
alter table assignment_attachments             enable row level security;
alter table assessment_attachments             enable row level security;

-- helper: current user's school
-- (existing helper functions is_system_admin() and the school_id-via-profiles
-- pattern are reused below)

-- ---------- assignment_standards ----------
create policy "as_select" on assignment_standards for select to authenticated
  using (
    is_system_admin()
    or assignment_id in (
      select id from assignments
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );
create policy "as_write" on assignment_standards for all to authenticated
  using (
    is_system_admin()
    or assignment_id in (
      select id from assignments
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  )
  with check (
    is_system_admin()
    or assignment_id in (
      select id from assignments
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

-- ---------- student_assignment_standards ----------
create policy "sas_select" on student_assignment_standards for select to authenticated
  using (
    is_system_admin()
    or student_assignment_id in (
      select sa.id from student_assignments sa
      join assignments a on a.id = sa.assignment_id
      where a.school_id in (select school_id from profiles where id = auth.uid())
    )
    -- parents: their child only
    or student_assignment_id in (
      select sa.id from student_assignments sa
      join parent_students ps on ps.student_id = sa.student_id
      where ps.parent_id = auth.uid()
    )
  );
create policy "sas_write" on student_assignment_standards for all to authenticated
  using (
    is_system_admin()
    or student_assignment_id in (
      select sa.id from student_assignments sa
      join assignments a on a.id = sa.assignment_id
      where a.school_id in (select school_id from profiles where id = auth.uid())
    )
  )
  with check (
    is_system_admin()
    or student_assignment_id in (
      select sa.id from student_assignments sa
      join assignments a on a.id = sa.assignment_id
      where a.school_id in (select school_id from profiles where id = auth.uid())
    )
  );

-- ---------- assignment_standard_assessments ----------
create policy "asa_select" on assignment_standard_assessments for select to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
    -- parents: their child + only family-visible standards
    or (
      student_id in (
        select student_id from parent_students where parent_id = auth.uid()
      )
      and standard_id in (select id from standards where visible_to_family = true)
    )
  );
create policy "asa_write" on assignment_standard_assessments for all to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  )
  with check (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  );

-- ---------- assignment_attachments ----------
create policy "aa_select" on assignment_attachments for select to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
    or assignment_id in (
      select sa.assignment_id from student_assignments sa
      join parent_students ps on ps.student_id = sa.student_id
      where ps.parent_id = auth.uid()
    )
  );
create policy "aa_write" on assignment_attachments for all to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  )
  with check (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  );

-- ---------- assessment_attachments ----------
create policy "ea_select" on assessment_attachments for select to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
    or assessment_id in (
      select asa.id from assignment_standard_assessments asa
      join parent_students ps on ps.student_id = asa.student_id
      where ps.parent_id = auth.uid()
        and asa.standard_id in (select id from standards where visible_to_family = true)
    )
  );
create policy "ea_write" on assessment_attachments for all to authenticated
  using (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  )
  with check (
    is_system_admin()
    or school_id in (select school_id from profiles where id = auth.uid())
  );

-- ============================================================
-- Trigger: snapshot-on-assign
-- When a student_assignments row is inserted, copy the parent's
-- assignment_standards into student_assignment_standards. Editing
-- a student's standards from then on diverges that one student only.
-- ============================================================

create or replace function snapshot_assignment_standards_on_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into student_assignment_standards (student_assignment_id, standard_id)
  select new.id, ast.standard_id
  from assignment_standards ast
  where ast.assignment_id = new.assignment_id
  on conflict (student_assignment_id, standard_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_snapshot_assignment_standards on student_assignments;
create trigger trg_snapshot_assignment_standards
  after insert on student_assignments
  for each row
  execute function snapshot_assignment_standards_on_assign();
