-- 001_initial_schema.sql
-- Living Assessment: initial database schema
-- All tenant tables carry school_id for row-level security.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUM types
-- ============================================================
create type user_role as enum ('admin', 'educator', 'parent');
create type observation_rating as enum ('1', '2', '3', '4', '5');

-- ============================================================
-- 1. schools
-- ============================================================
create table schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 2. profiles  (extends auth.users)
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  role        user_role not null default 'educator',
  full_name   text not null,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 3. classrooms
-- ============================================================
create table classrooms (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  grade_level text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 4. educator_classrooms  (many-to-many)
-- ============================================================
create table educator_classrooms (
  id            uuid primary key default gen_random_uuid(),
  educator_id   uuid not null references profiles(id) on delete cascade,
  classroom_id  uuid not null references classrooms(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (educator_id, classroom_id)
);

-- ============================================================
-- 5. students
-- ============================================================
create table students (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  classroom_id  uuid not null references classrooms(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  date_of_birth date,
  grade_level   text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 6. parent_students  (links parents to their children)
-- ============================================================
create table parent_students (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references profiles(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (parent_id, student_id)
);

-- ============================================================
-- 7. dimensions  (competency dimensions)
-- ============================================================
create table dimensions (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  name          text not null,
  description   text,
  display_order int not null default 0,
  icon          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 8. observations
-- ============================================================
create table observations (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  dimension_id  uuid not null references dimensions(id) on delete cascade,
  observer_id   uuid not null references profiles(id) on delete cascade,
  rating        observation_rating not null,
  notes         text,
  observed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 9. interest_surveys
-- ============================================================
create table interest_surveys (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  responses   jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 10. standards_frameworks
-- ============================================================
create table standards_frameworks (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  description text,
  version     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 11. standards  (individual standards within a framework)
-- ============================================================
create table standards (
  id            uuid primary key default gen_random_uuid(),
  framework_id  uuid not null references standards_frameworks(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  code          text not null,
  description   text not null,
  grade_level   text,
  parent_id     uuid references standards(id) on delete cascade,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 12. dimension_standards  (maps dimensions to standards)
-- ============================================================
create table dimension_standards (
  id            uuid primary key default gen_random_uuid(),
  dimension_id  uuid not null references dimensions(id) on delete cascade,
  standard_id   uuid not null references standards(id) on delete cascade,
  school_id     uuid not null references schools(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (dimension_id, standard_id)
);

-- ============================================================
-- 13. student_sessions  (anonymous/student-facing tokens)
-- ============================================================
create table student_sessions (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  school_id   uuid not null references schools(id) on delete cascade,
  token       text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_profiles_school_id        on profiles(school_id);
create index idx_classrooms_school_id      on classrooms(school_id);
create index idx_students_school_id        on students(school_id);
create index idx_students_classroom_id     on students(classroom_id);
create index idx_observations_student_id   on observations(student_id);
create index idx_observations_dimension_id on observations(dimension_id);
create index idx_observations_observer_id  on observations(observer_id);
create index idx_observations_school_id    on observations(school_id);
create index idx_observations_observed_at  on observations(observed_at);
create index idx_interest_surveys_student  on interest_surveys(student_id);
create index idx_standards_framework_id    on standards(framework_id);
create index idx_standards_school_id       on standards(school_id);
create index idx_student_sessions_token    on student_sessions(token);
create index idx_student_sessions_student  on student_sessions(student_id);
create index idx_parent_students_parent    on parent_students(parent_id);
create index idx_parent_students_student   on parent_students(student_id);
create index idx_educator_classrooms_educator  on educator_classrooms(educator_id);
create index idx_educator_classrooms_classroom on educator_classrooms(classroom_id);

-- ============================================================
-- Updated-at trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to all tables with updated_at
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'schools','profiles','classrooms','students',
      'dimensions','observations','interest_surveys',
      'standards_frameworks','standards'
    ])
  loop
    execute format(
      'create trigger trg_%s_updated_at before update on %I
       for each row execute function set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- Composite competency score function
-- Average of the last 5 observation ratings per student per dimension
-- ============================================================
create or replace function compute_competency_score(
  p_student_id uuid,
  p_dimension_id uuid
)
returns numeric as $$
  select coalesce(
    round(avg(rating_val), 2),
    0
  )
  from (
    select (rating::text)::numeric as rating_val
    from observations
    where student_id = p_student_id
      and dimension_id = p_dimension_id
    order by observed_at desc
    limit 5
  ) recent;
$$ language sql stable;

-- Batch version: all dimensions for a single student
create or replace function compute_all_competency_scores(p_student_id uuid)
returns table(dimension_id uuid, dimension_name text, score numeric) as $$
  select
    d.id as dimension_id,
    d.name as dimension_name,
    coalesce(round(avg(sub.rating_val), 2), 0) as score
  from dimensions d
  left join lateral (
    select (o.rating::text)::numeric as rating_val
    from observations o
    where o.student_id = p_student_id
      and o.dimension_id = d.id
    order by o.observed_at desc
    limit 5
  ) sub on true
  where d.school_id = (select school_id from students where id = p_student_id)
  group by d.id, d.name, d.display_order
  order by d.display_order;
$$ language sql stable;

-- ============================================================
-- Seed data
-- ============================================================

-- Demo school
insert into schools (id, name, slug) values
  ('a0000000-0000-4000-8000-000000000001', 'Embark Academy', 'embark-academy');

-- Dimensions (10 default)
insert into dimensions (id, school_id, name, description, display_order, icon) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Language & Literacy',
   'Reading, writing, speaking, and listening skills across genres and contexts.',
   1, 'book-open'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Mathematical Thinking',
   'Number sense, operations, patterns, algebraic reasoning, and problem solving.',
   2, 'calculator'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Scientific Inquiry',
   'Observation, hypothesis formation, experimentation, and evidence-based reasoning.',
   3, 'microscope'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Social Studies & Global Awareness',
   'Geography, history, civics, economics, and understanding diverse cultures.',
   4, 'globe'),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'Creative Expression',
   'Visual arts, music, dance, drama, and imaginative design thinking.',
   5, 'palette'),
  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Physical Development & Wellness',
   'Gross and fine motor skills, health habits, nutrition awareness, and body regulation.',
   6, 'heart-pulse'),
  ('d0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   'Social-Emotional Learning',
   'Self-awareness, empathy, relationship skills, and responsible decision-making.',
   7, 'users'),
  ('d0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'Critical Thinking & Problem Solving',
   'Analysis, evaluation, logical reasoning, and creative solution development.',
   8, 'lightbulb'),
  ('d0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001',
   'Communication & Collaboration',
   'Effective expression of ideas, active listening, teamwork, and conflict resolution.',
   9, 'message-circle'),
  ('d0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001',
   'Self-Direction & Executive Function',
   'Goal setting, time management, organization, self-monitoring, and perseverance.',
   10, 'compass');

-- Classrooms (3)
insert into classrooms (id, school_id, name, grade_level) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Lower Elementary', 'K-2'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Upper Elementary', '3-5'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Middle School', '6-8');

-- Students (10 across classrooms)
insert into students (id, school_id, classroom_id, first_name, last_name, grade_level) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'Amara', 'Johnson', 'K'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'Liam', 'Chen', '1'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000001', 'Sofia', 'Rodriguez', '2'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'Noah', 'Williams', '3'),
  ('e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'Zara', 'Patel', '4'),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'Ethan', 'Kim', '5'),
  ('e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000003', 'Maya', 'Thompson', '6'),
  ('e0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000003', 'Oliver', 'Nakamura', '7'),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000003', 'Ava', 'Singh', '8'),
  ('e0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001',
   'c0000000-0000-4000-8000-000000000002', 'Leo', 'Martinez', '3');

-- Standards framework: Common Core Math K-5
insert into standards_frameworks (id, school_id, name, description, version) values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Common Core State Standards — Mathematics K-5',
   'Domain and cluster-level standards for elementary mathematics.',
   '2010');

-- Common Core Math domains (top-level standards)
insert into standards (id, framework_id, school_id, code, description, grade_level, parent_id, display_order) values
  -- Kindergarten
  ('ee000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.CC', 'Counting & Cardinality', 'K', null, 1),
  ('ee000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.OA', 'Operations & Algebraic Thinking', 'K', null, 2),
  ('ee000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.NBT', 'Number & Operations in Base Ten', 'K', null, 3),
  ('ee000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.MD', 'Measurement & Data', 'K', null, 4),
  ('ee000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.G', 'Geometry', 'K', null, 5),

  -- Kindergarten clusters (children of domains)
  ('ee000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.CC.A', 'Know number names and the count sequence', 'K',
   'ee000000-0000-4000-8000-000000000001', 1),
  ('ee000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.CC.B', 'Count to tell the number of objects', 'K',
   'ee000000-0000-4000-8000-000000000001', 2),
  ('ee000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'K.CC.C', 'Compare numbers', 'K',
   'ee000000-0000-4000-8000-000000000001', 3),

  -- Grade 1
  ('ee000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.OA', 'Operations & Algebraic Thinking', '1', null, 1),
  ('ee000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.NBT', 'Number & Operations in Base Ten', '1', null, 2),
  ('ee000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.MD', 'Measurement & Data', '1', null, 3),
  ('ee000000-0000-4000-8000-000000000013', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.G', 'Geometry', '1', null, 4),

  -- Grade 1 clusters
  ('ee000000-0000-4000-8000-000000000014', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.OA.A', 'Represent and solve problems involving addition and subtraction', '1',
   'ee000000-0000-4000-8000-000000000010', 1),
  ('ee000000-0000-4000-8000-000000000015', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.OA.B', 'Understand and apply properties of operations', '1',
   'ee000000-0000-4000-8000-000000000010', 2),
  ('ee000000-0000-4000-8000-000000000016', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.OA.C', 'Add and subtract within 20', '1',
   'ee000000-0000-4000-8000-000000000010', 3),
  ('ee000000-0000-4000-8000-000000000017', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '1.OA.D', 'Work with addition and subtraction equations', '1',
   'ee000000-0000-4000-8000-000000000010', 4),

  -- Grade 2
  ('ee000000-0000-4000-8000-000000000020', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '2.OA', 'Operations & Algebraic Thinking', '2', null, 1),
  ('ee000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '2.NBT', 'Number & Operations in Base Ten', '2', null, 2),
  ('ee000000-0000-4000-8000-000000000022', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '2.MD', 'Measurement & Data', '2', null, 3),
  ('ee000000-0000-4000-8000-000000000023', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '2.G', 'Geometry', '2', null, 4),

  -- Grade 3
  ('ee000000-0000-4000-8000-000000000030', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '3.OA', 'Operations & Algebraic Thinking', '3', null, 1),
  ('ee000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '3.NBT', 'Number & Operations in Base Ten', '3', null, 2),
  ('ee000000-0000-4000-8000-000000000032', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '3.NF', 'Number & Operations — Fractions', '3', null, 3),
  ('ee000000-0000-4000-8000-000000000033', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '3.MD', 'Measurement & Data', '3', null, 4),
  ('ee000000-0000-4000-8000-000000000034', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '3.G', 'Geometry', '3', null, 5),

  -- Grade 4
  ('ee000000-0000-4000-8000-000000000040', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '4.OA', 'Operations & Algebraic Thinking', '4', null, 1),
  ('ee000000-0000-4000-8000-000000000041', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '4.NBT', 'Number & Operations in Base Ten', '4', null, 2),
  ('ee000000-0000-4000-8000-000000000042', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '4.NF', 'Number & Operations — Fractions', '4', null, 3),
  ('ee000000-0000-4000-8000-000000000043', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '4.MD', 'Measurement & Data', '4', null, 4),
  ('ee000000-0000-4000-8000-000000000044', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '4.G', 'Geometry', '4', null, 5),

  -- Grade 5
  ('ee000000-0000-4000-8000-000000000050', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '5.OA', 'Operations & Algebraic Thinking', '5', null, 1),
  ('ee000000-0000-4000-8000-000000000051', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '5.NBT', 'Number & Operations in Base Ten', '5', null, 2),
  ('ee000000-0000-4000-8000-000000000052', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '5.NF', 'Number & Operations — Fractions', '5', null, 3),
  ('ee000000-0000-4000-8000-000000000053', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '5.MD', 'Measurement & Data', '5', null, 4),
  ('ee000000-0000-4000-8000-000000000054', 'f0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', '5.G', 'Geometry', '5', null, 5);
