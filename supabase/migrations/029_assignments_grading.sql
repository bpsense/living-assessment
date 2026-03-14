-- 029_assignments_grading.sql
-- Assignment and grading tables: teachers create assignments linked to competencies,
-- assign to individual students or whole classes, and grade per-competency.

-- ============================================================
-- ENUM types
-- ============================================================

create type assignment_type as enum ('individual', 'class');
create type assignment_status as enum ('draft', 'active', 'completed');
create type student_assignment_status as enum ('assigned', 'in_progress', 'submitted', 'graded');
create type competency_score_source as enum ('teacher', 'ai_inferred', 'observation');

-- ============================================================
-- Tables
-- ============================================================

create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  classroom_id    uuid references classrooms(id) on delete set null,
  teacher_id      uuid not null references profiles(id) on delete cascade,
  title           text not null,
  description     text,
  due_date        date,
  assignment_type assignment_type not null default 'class',
  status          assignment_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists assignment_competencies (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid not null references assignments(id) on delete cascade,
  competency_id   uuid not null references competencies(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (assignment_id, competency_id)
);

create table if not exists student_assignments (
  id                    uuid primary key default gen_random_uuid(),
  assignment_id         uuid not null references assignments(id) on delete cascade,
  student_id            uuid not null references students(id) on delete cascade,
  status                student_assignment_status not null default 'assigned',
  assigned_at           timestamptz not null default now(),
  submitted_at          timestamptz,
  graded_at             timestamptz,
  qualitative_feedback  text,
  ai_inferred_scores    jsonb,
  -- ai_inferred_scores shape:
  -- [{ "competency_id": "uuid", "suggested_score": 2.33, "reasoning": "..." }, ...]
  graded_by             uuid references profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists competency_scores (
  id                      uuid primary key default gen_random_uuid(),
  student_assignment_id   uuid references student_assignments(id) on delete cascade,
  competency_id           uuid not null references competencies(id) on delete cascade,
  student_id              uuid not null references students(id) on delete cascade,
  school_id               uuid not null references schools(id) on delete cascade,
  score                   numeric(4,2) not null check (score >= 0 and score <= 4),
  source                  competency_score_source not null default 'teacher',
  notes                   text,
  scored_at               timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_assignments_school on assignments(school_id);
create index idx_assignments_teacher on assignments(teacher_id);
create index idx_assignments_classroom on assignments(classroom_id);
create index idx_assignments_status on assignments(school_id, status);
create index idx_assignment_competencies_assignment on assignment_competencies(assignment_id);
create index idx_assignment_competencies_competency on assignment_competencies(competency_id);
create index idx_student_assignments_assignment on student_assignments(assignment_id);
create index idx_student_assignments_student on student_assignments(student_id);
create index idx_student_assignments_status on student_assignments(status);
create index idx_competency_scores_student on competency_scores(student_id);
create index idx_competency_scores_competency on competency_scores(competency_id);
create index idx_competency_scores_student_assignment on competency_scores(student_assignment_id);
create index idx_competency_scores_scored_at on competency_scores(student_id, scored_at);
create index idx_competency_scores_school on competency_scores(school_id);

-- ============================================================
-- Triggers
-- ============================================================

create trigger set_assignments_updated_at
  before update on assignments
  for each row execute function set_updated_at();

create trigger set_student_assignments_updated_at
  before update on student_assignments
  for each row execute function set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table assignments enable row level security;
alter table assignment_competencies enable row level security;
alter table student_assignments enable row level security;
alter table competency_scores enable row level security;

-- Assignments: educators in same school can read, creators + admins can write
create policy "assignments_select"
  on assignments for select to authenticated
  using (
    school_id in (select school_id from profiles where id = auth.uid())
  );

create policy "assignments_insert"
  on assignments for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "assignments_update"
  on assignments for update to authenticated
  using (
    teacher_id = auth.uid()
    or school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "assignments_delete"
  on assignments for delete to authenticated
  using (
    teacher_id = auth.uid()
    or school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Assignment competencies: readable by school, writable by assignment creator
create policy "assignment_competencies_select"
  on assignment_competencies for select to authenticated
  using (
    assignment_id in (
      select id from assignments
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

create policy "assignment_competencies_insert"
  on assignment_competencies for insert to authenticated
  with check (
    assignment_id in (
      select id from assignments
      where teacher_id = auth.uid()
        or school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

create policy "assignment_competencies_delete"
  on assignment_competencies for delete to authenticated
  using (
    assignment_id in (
      select id from assignments
      where teacher_id = auth.uid()
        or school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

-- Student assignments: educators see own school, students see own, parents see children
create policy "student_assignments_select"
  on student_assignments for select to authenticated
  using (
    -- Educator/admin in same school
    assignment_id in (
      select id from assignments
      where school_id in (select school_id from profiles where id = auth.uid())
    )
    or
    -- Student sees own
    student_id in (
      select s.id from students s
      join profiles p on p.student_id = s.id
      where p.id = auth.uid()
    )
    or
    -- Parent sees linked children
    student_id in (
      select ps.student_id from parent_students ps
      where ps.parent_id = auth.uid()
    )
  );

create policy "student_assignments_insert"
  on student_assignments for insert to authenticated
  with check (
    assignment_id in (
      select id from assignments
      where teacher_id = auth.uid()
        or school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

create policy "student_assignments_update"
  on student_assignments for update to authenticated
  using (
    -- Teacher/admin can update (grading)
    assignment_id in (
      select id from assignments
      where teacher_id = auth.uid()
        or school_id in (
          select school_id from profiles
          where id = auth.uid() and role in ('admin', 'educator')
        )
    )
    or
    -- Student can update own status (in_progress, submitted)
    student_id in (
      select s.id from students s
      join profiles p on p.student_id = s.id
      where p.id = auth.uid()
    )
  );

-- Competency scores: same school can read, educators/admins can write
create policy "competency_scores_select"
  on competency_scores for select to authenticated
  using (
    school_id in (select school_id from profiles where id = auth.uid())
    or
    student_id in (
      select s.id from students s
      join profiles p on p.student_id = s.id
      where p.id = auth.uid()
    )
    or
    student_id in (
      select ps.student_id from parent_students ps
      where ps.parent_id = auth.uid()
    )
  );

create policy "competency_scores_insert"
  on competency_scores for insert to authenticated
  with check (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "competency_scores_update"
  on competency_scores for update to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );
