-- 011_learning_suggestions.sql
-- Cached AI-generated learning suggestions per student profile state.

create table learning_suggestions (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  -- Deterministic hash of zone data for cache lookups
  zone_hash       text not null,
  -- The zone data sent to the AI (for debugging / audit)
  zone_data       jsonb not null,
  -- AI-generated suggestions array
  suggestions     jsonb not null,
  -- Per-suggestion educator actions: { "sug-1": { dismissed: true }, ... }
  educator_actions jsonb not null default '{}',
  -- Who requested generation
  requested_by    uuid not null references profiles(id) on delete cascade,
  -- Prompt template version (bump to invalidate cache when prompt changes)
  prompt_version  text not null default 'v1',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Cache lookup index
create index idx_learning_suggestions_cache
  on learning_suggestions(student_id, zone_hash, prompt_version);

create index idx_learning_suggestions_school
  on learning_suggestions(school_id);

-- Updated-at trigger (reuses the set_updated_at function from 001)
create trigger trg_learning_suggestions_updated_at
  before update on learning_suggestions
  for each row execute function set_updated_at();

-- RLS
alter table learning_suggestions enable row level security;

-- Educators & admins can read suggestions in their school
create policy "learning_suggestions_select_admin"
  on learning_suggestions for select
  using (school_id = auth_school_id() and auth_role() = 'admin');

create policy "learning_suggestions_select_educator"
  on learning_suggestions for select
  using (
    auth_role() = 'educator'
    and student_id in (
      select s.id from students s
      where s.classroom_id in (
        select classroom_id from educator_classrooms where educator_id = auth.uid()
      )
    )
  );

-- Insert: staff can create suggestions for students in their school
create policy "learning_suggestions_insert_admin"
  on learning_suggestions for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "learning_suggestions_insert_educator"
  on learning_suggestions for insert
  with check (
    school_id = auth_school_id()
    and auth_role() = 'educator'
    and student_id in (
      select s.id from students s
      where s.classroom_id in (
        select classroom_id from educator_classrooms where educator_id = auth.uid()
      )
    )
  );

-- Update: staff can update educator_actions on suggestions
create policy "learning_suggestions_update_admin"
  on learning_suggestions for update
  using (school_id = auth_school_id() and auth_role() = 'admin')
  with check (school_id = auth_school_id());

create policy "learning_suggestions_update_educator"
  on learning_suggestions for update
  using (
    auth_role() = 'educator'
    and student_id in (
      select s.id from students s
      where s.classroom_id in (
        select classroom_id from educator_classrooms where educator_id = auth.uid()
      )
    )
  )
  with check (school_id = auth_school_id());

-- Delete: admin only
create policy "learning_suggestions_delete_admin"
  on learning_suggestions for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');
