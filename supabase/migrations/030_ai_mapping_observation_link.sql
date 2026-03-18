-- 030_ai_mapping_observation_link.sql
-- AI competency → dimension mapping table and observation enhancement
-- to optionally link observations to assignments.

-- ============================================================
-- AI Competency → Dimension Mapping
-- ============================================================

create table if not exists competency_dimension_mappings (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  competency_id   uuid not null references competencies(id) on delete cascade,
  dimension_id    uuid not null references dimensions(id) on delete cascade,
  confidence      numeric(3,2) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  reasoning       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, competency_id, dimension_id)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_comp_dim_mappings_school on competency_dimension_mappings(school_id);
create index idx_comp_dim_mappings_competency on competency_dimension_mappings(competency_id);
create index idx_comp_dim_mappings_dimension on competency_dimension_mappings(dimension_id);
create index idx_comp_dim_mappings_school_dimension on competency_dimension_mappings(school_id, dimension_id);

-- ============================================================
-- Trigger
-- ============================================================

create trigger set_comp_dim_mappings_updated_at
  before update on competency_dimension_mappings
  for each row execute function set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table competency_dimension_mappings enable row level security;

-- Readable by all school members
create policy "comp_dim_mappings_select"
  on competency_dimension_mappings for select to authenticated
  using (school_id in (select school_id from profiles where id = auth.uid()));

-- Writable by admins and educators (AI edge function runs as service role, bypasses RLS)
create policy "comp_dim_mappings_insert"
  on competency_dimension_mappings for insert to authenticated
  with check (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "comp_dim_mappings_update"
  on competency_dimension_mappings for update to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "comp_dim_mappings_delete"
  on competency_dimension_mappings for delete to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- Observation Enhancement: optional assignment linking
-- ============================================================

alter table observations
  add column if not exists assignment_id uuid references assignments(id) on delete set null,
  add column if not exists student_assignment_id uuid references student_assignments(id) on delete set null;

create index idx_observations_assignment on observations(assignment_id) where assignment_id is not null;
create index idx_observations_student_assignment on observations(student_assignment_id) where student_assignment_id is not null;
