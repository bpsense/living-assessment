-- 101_assignments.sql
--
-- From-scratch rebuild of the assignment subsystem (the legacy one was fully
-- torn out in 098). Two assignment shapes share one template table:
--   * 'project'      — Project-Based Learning (driving question, PBL phases, …)
--   * 'focused_task' — a targeted, scaffolded skill task
--
-- Assessment model (the key integration point): an educator records an
-- `assignment_observation` against a student's assignment instance. When
-- feeds_amoeba = true a mirrored row is written into `observations` by the
-- sync trigger below — `observations` is the SOLE amoeba feed
-- (see src/lib/observation-snapshots.ts), so assignment assessments flow into
-- the Living Blob timeline with NO change to the snapshot pipeline.
--
-- Level → rating: emerging=1, developing=2, achieving=3, mastery=4 — the same
-- LEVEL_SCORE map used in src/lib/standards-assignment-data.ts. 1/2/3/4 are
-- valid points on the observations 0.33–4.0 (⅓-step) rating scale.
--
-- Conventions match the rest of the tree: school_id on every table, RLS via
-- auth_school_id()/auth_role()/is_system_admin(), updated_at via
-- set_updated_at(), guarded enum creation. No explicit transaction wrapper
-- (Supabase runs each migration in its own transaction).

-- ============================================================
-- 1. Enums
--    (assignment_type / assignment_status / assessment_level were dropped in
--     098; library_status / scaffolding_level are new. assignment_status gains
--     'archived' for soft-delete of templates.)
-- ============================================================
do $$ begin create type assignment_type   as enum ('project','focused_task');                exception when duplicate_object then null; end $$;
do $$ begin create type scaffolding_level as enum ('introductory','developing','extending');  exception when duplicate_object then null; end $$;
do $$ begin create type assignment_status as enum ('draft','published','archived');           exception when duplicate_object then null; end $$;
do $$ begin create type library_status    as enum ('private','school_library');               exception when duplicate_object then null; end $$;
do $$ begin create type assessment_level  as enum ('emerging','developing','achieving','mastery'); exception when duplicate_object then null; end $$;

-- ============================================================
-- 2. assignments  — reusable template, separate from per-student assignment
-- ============================================================
create table if not exists assignments (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references schools(id) on delete cascade,
  created_by         uuid not null references profiles(id),
  assignment_type    assignment_type not null,
  title              text not null,
  description        text,
  -- Project / PBL only (null for focused_task)
  driving_question   text,
  authentic_context  text,
  learner_voice      text,
  pbl_phases         jsonb,   -- array of { phase, title, description, learning_goals[], key_activities[], milestone }
  -- Focused task only (null for project)
  focus_area         text,
  learning_intention text,    -- "what will the student know or be able to do?" (form field w/o a spec column → dedicated column)
  instructions       text,
  success_criteria   text,
  scaffolding_level  scaffolding_level,
  -- Shared
  task_format        text check (task_format in ('written','practical','presentation','creative','research','observation','discussion','other')),
  collaboration_type text check (collaboration_type in ('individual','small_group','whole_class')),
  reflection_prompts text[],
  age_min            int,
  age_max            int,
  duration_estimate  text,
  materials          text,
  status             assignment_status not null default 'draft',
  library_status     library_status    not null default 'private',
  visible_to_family  boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_assignments_school     on assignments(school_id);
create index if not exists idx_assignments_created_by on assignments(created_by);
-- Library browse: school's published, shared templates.
create index if not exists idx_assignments_library    on assignments(school_id, library_status, status);

comment on table assignments is
  'Reusable assignment templates (project | focused_task). Assigned to students via student_assignments. library_status=school_library surfaces it in the shared library.';

-- ============================================================
-- 3. assignment_dimensions  — template ↔ school dimensions (many-to-many)
-- ============================================================
create table if not exists assignment_dimensions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  dimension_id  uuid not null references dimensions(id)  on delete cascade,
  school_id     uuid not null references schools(id)     on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, dimension_id)
);
create index if not exists idx_assignment_dimensions_assignment on assignment_dimensions(assignment_id);
create index if not exists idx_assignment_dimensions_dimension  on assignment_dimensions(dimension_id);

-- ============================================================
-- 4. assignment_competencies  — template ↔ school competencies (many-to-many)
-- ============================================================
create table if not exists assignment_competencies (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id)   on delete cascade,
  competency_id uuid not null references competencies(id)  on delete cascade,
  school_id     uuid not null references schools(id)       on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, competency_id)
);
create index if not exists idx_assignment_competencies_assignment on assignment_competencies(assignment_id);
create index if not exists idx_assignment_competencies_competency on assignment_competencies(competency_id);

-- ============================================================
-- 5. student_assignments  — one row per (student, assignment)
-- ============================================================
create table if not exists student_assignments (
  id                uuid primary key default gen_random_uuid(),
  assignment_id     uuid not null references assignments(id) on delete cascade,
  student_id        uuid not null references students(id)    on delete cascade,
  -- Classroom context of the assignment. NULL for individual-mode assignment
  -- from a student profile (no classroom). SET NULL if the classroom is removed.
  classroom_id      uuid references classrooms(id) on delete set null,
  school_id         uuid not null references schools(id)     on delete cascade,
  assigned_by       uuid not null references profiles(id),
  assigned_at       timestamptz not null default now(),
  due_date          date,
  status            text not null default 'assigned'
                      check (status in ('assigned','in_progress','complete','archived')),
  -- NULL = inherit assignments.visible_to_family; explicit value overrides per student.
  visible_to_family boolean,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists idx_student_assignments_assignment on student_assignments(assignment_id);
create index if not exists idx_student_assignments_student    on student_assignments(student_id);
create index if not exists idx_student_assignments_classroom  on student_assignments(classroom_id);
create index if not exists idx_student_assignments_school     on student_assignments(school_id);

-- ============================================================
-- 6. assignment_observations  — assessment tied to a student's assignment.
--    Mirrors into `observations` (the amoeba feed) via the trigger in §9.
-- ============================================================
create table if not exists assignment_observations (
  id                    uuid primary key default gen_random_uuid(),
  student_assignment_id uuid not null references student_assignments(id) on delete cascade,
  student_id            uuid not null references students(id)   on delete cascade,
  school_id             uuid not null references schools(id)    on delete cascade,
  dimension_id          uuid not null references dimensions(id) on delete cascade,
  competency_id         uuid references competencies(id) on delete set null,
  observer_id           uuid not null references profiles(id),
  observation_type      text not null default 'formative'
                          check (observation_type in ('formative','summative','anecdotal')),
  level                 assessment_level not null,
  notes                 text,
  observed_at           timestamptz not null default now(),
  -- When true, a mirrored observations row is written/kept in sync by the trigger.
  feeds_amoeba          boolean not null default true,
  -- Back-reference to the mirrored observations row (set by the trigger).
  linked_observation_id uuid references observations(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists idx_assignment_observations_sa        on assignment_observations(student_assignment_id);
create index if not exists idx_assignment_observations_student   on assignment_observations(student_id);
create index if not exists idx_assignment_observations_school    on assignment_observations(school_id);
create index if not exists idx_assignment_observations_dimension on assignment_observations(dimension_id);
create index if not exists idx_assignment_observations_observed  on assignment_observations(observed_at);

-- ============================================================
-- 7. assignment_library_gratitude  — one appreciation per (educator, assignment)
-- ============================================================
create table if not exists assignment_library_gratitude (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  educator_id   uuid not null references profiles(id)    on delete cascade,
  school_id     uuid not null references schools(id)     on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, educator_id)   -- DB-level dedup
);
create index if not exists idx_assignment_gratitude_assignment on assignment_library_gratitude(assignment_id);
create index if not exists idx_assignment_gratitude_school     on assignment_library_gratitude(school_id);

-- ============================================================
-- 8. updated_at triggers (tables that carry updated_at)
-- ============================================================
drop trigger if exists trg_assignments_updated_at on assignments;
create trigger trg_assignments_updated_at
  before update on assignments
  for each row execute function set_updated_at();

drop trigger if exists trg_student_assignments_updated_at on student_assignments;
create trigger trg_student_assignments_updated_at
  before update on student_assignments
  for each row execute function set_updated_at();

-- ============================================================
-- 9. Amoeba feed trigger
--    BEFORE INSERT/UPDATE/DELETE on assignment_observations keeps a mirrored
--    `observations` row in lockstep. SECURITY DEFINER so the mirror write
--    bypasses RLS (the caller already passed assignment_observations RLS).
--    BEFORE (not AFTER) lets us set linked_observation_id in the same row write
--    — no second UPDATE, no re-entrancy.
-- ============================================================
create or replace function sync_assignment_observation_to_amoeba()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rating numeric;
  v_obs_id uuid;
begin
  -- level → numeric rating (mirrors LEVEL_SCORE in standards-assignment-data.ts)
  if tg_op in ('INSERT','UPDATE') then
    v_rating := case new.level
      when 'emerging'   then 1.0
      when 'developing' then 2.0
      when 'achieving'  then 3.0
      when 'mastery'    then 4.0
    end;
  end if;

  if tg_op = 'DELETE' then
    -- Removing the assessment removes its amoeba contribution.
    if old.linked_observation_id is not null then
      delete from observations where id = old.linked_observation_id;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.feeds_amoeba then
      insert into observations
        (school_id, student_id, dimension_id, competency_id, observer_id, rating, notes, observed_at)
      values
        (new.school_id, new.student_id, new.dimension_id, new.competency_id, new.observer_id, v_rating, new.notes, new.observed_at)
      returning id into v_obs_id;
      new.linked_observation_id := v_obs_id;
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'
  if old.feeds_amoeba and not new.feeds_amoeba then
    -- turned off → drop the mirror
    if old.linked_observation_id is not null then
      delete from observations where id = old.linked_observation_id;
    end if;
    new.linked_observation_id := null;

  elsif not old.feeds_amoeba and new.feeds_amoeba then
    -- turned on → create the mirror
    insert into observations
      (school_id, student_id, dimension_id, competency_id, observer_id, rating, notes, observed_at)
    values
      (new.school_id, new.student_id, new.dimension_id, new.competency_id, new.observer_id, v_rating, new.notes, new.observed_at)
    returning id into v_obs_id;
    new.linked_observation_id := v_obs_id;

  elsif new.feeds_amoeba and old.feeds_amoeba then
    -- stayed on → keep the mirror in sync (level/dimension/competency/notes/date)
    if new.linked_observation_id is not null then
      update observations
        set rating        = v_rating,
            dimension_id  = new.dimension_id,
            competency_id = new.competency_id,
            notes         = new.notes,
            observed_at   = new.observed_at
        where id = new.linked_observation_id;
    else
      -- defensive: flag on but mirror missing → recreate
      insert into observations
        (school_id, student_id, dimension_id, competency_id, observer_id, rating, notes, observed_at)
      values
        (new.school_id, new.student_id, new.dimension_id, new.competency_id, new.observer_id, v_rating, new.notes, new.observed_at)
      returning id into v_obs_id;
      new.linked_observation_id := v_obs_id;
    end if;
  end if;

  return new;
end $$;

-- Trigger-only function: not callable directly from the client (matches 092).
revoke execute on function sync_assignment_observation_to_amoeba() from public, anon, authenticated;

drop trigger if exists trg_sync_assignment_observation on assignment_observations;
create trigger trg_sync_assignment_observation
  before insert or update or delete on assignment_observations
  for each row execute function sync_assignment_observation_to_amoeba();

-- ============================================================
-- 10. RLS
--     Pattern (per 002 / 077): same-school authenticated users read; educators
--     & admins (dept-admins are role=educator at the DB level) write; system
--     admins always pass. Parents read their child's rows and learners read
--     their own, both gated by COALESCE(sa.visible_to_family, a.visible_to_family).
-- ============================================================
alter table assignments                   enable row level security;
alter table assignment_dimensions         enable row level security;
alter table assignment_competencies       enable row level security;
alter table student_assignments           enable row level security;
alter table assignment_observations       enable row level security;
alter table assignment_library_gratitude  enable row level security;

-- ---------- assignments ----------
-- Read: anyone in the school; plus parents/learners for templates assigned to
-- their child/self where the (per-student → template) visibility resolves true.
create policy "assignments_select" on assignments for select to authenticated
  using (
    is_system_admin()
    or school_id = auth_school_id()
    or exists (
      select 1 from student_assignments sa
      where sa.assignment_id = assignments.id
        and coalesce(sa.visible_to_family, assignments.visible_to_family) = true
        and (
          sa.student_id in (select student_id from parent_students where parent_id = auth.uid())
          or sa.student_id = (select student_id from profiles where id = auth.uid())
        )
    )
  );
create policy "assignments_write" on assignments for all to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')))
  with check (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- assignment_dimensions ----------
create policy "assignment_dimensions_select" on assignment_dimensions for select to authenticated
  using (is_system_admin() or school_id = auth_school_id());
create policy "assignment_dimensions_write" on assignment_dimensions for all to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')))
  with check (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- assignment_competencies ----------
create policy "assignment_competencies_select" on assignment_competencies for select to authenticated
  using (is_system_admin() or school_id = auth_school_id());
create policy "assignment_competencies_write" on assignment_competencies for all to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')))
  with check (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- student_assignments ----------
-- Parents (their child) + learners (self), gated by resolved family visibility.
create policy "student_assignments_select" on student_assignments for select to authenticated
  using (
    is_system_admin()
    or school_id = auth_school_id()
    or (
      coalesce(visible_to_family, (select a.visible_to_family from assignments a where a.id = assignment_id)) = true
      and (
        student_id in (select student_id from parent_students where parent_id = auth.uid())
        or student_id = (select student_id from profiles where id = auth.uid())
      )
    )
  );
create policy "student_assignments_write" on student_assignments for all to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')))
  with check (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- assignment_observations ----------
create policy "assignment_observations_select" on assignment_observations for select to authenticated
  using (
    is_system_admin()
    or school_id = auth_school_id()
    or (
      (
        student_id in (select student_id from parent_students where parent_id = auth.uid())
        or student_id = (select student_id from profiles where id = auth.uid())
      )
      and exists (
        select 1 from student_assignments sa
        join assignments a on a.id = sa.assignment_id
        where sa.id = assignment_observations.student_assignment_id
          and coalesce(sa.visible_to_family, a.visible_to_family) = true
      )
    )
  );
create policy "assignment_observations_write" on assignment_observations for all to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')))
  with check (is_system_admin() or (school_id = auth_school_id() and auth_role() in ('admin','educator')));

-- ---------- assignment_library_gratitude ----------
-- Read across the school (for counts + "did I appreciate this"). Write only
-- your own row (educator_id = auth.uid()); the unique constraint dedups.
create policy "assignment_library_gratitude_select" on assignment_library_gratitude for select to authenticated
  using (is_system_admin() or school_id = auth_school_id());
create policy "assignment_library_gratitude_write" on assignment_library_gratitude for all to authenticated
  using (is_system_admin() or (school_id = auth_school_id() and educator_id = auth.uid()))
  with check (
    is_system_admin()
    or (school_id = auth_school_id() and educator_id = auth.uid() and auth_role() in ('admin','educator'))
  );
