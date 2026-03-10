-- 025_family_support.sql
-- Cached AI-generated family support suggestions.
-- Parents see warm, actionable ideas for supporting learning at home.
-- Educators/admins can annotate each suggestion with notes visible to families.

create table family_support_suggestions (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  -- Deterministic hash of zone data for cache lookups
  zone_hash       text not null,
  -- The zone data sent to the AI (for debugging / audit)
  zone_data       jsonb not null,
  -- AI-generated suggestions array (FamilySuggestion[])
  suggestions     jsonb not null,
  -- Per-suggestion educator notes: { "sug-1": { note, author_id, author_name, updated_at } }
  educator_notes  jsonb not null default '{}',
  -- Who requested generation
  requested_by    uuid not null references profiles(id) on delete cascade,
  -- Prompt template version (bump to invalidate cache when prompt changes)
  prompt_version  text not null default 'v1',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Cache lookup index
create index idx_family_support_cache
  on family_support_suggestions(student_id, zone_hash, prompt_version);

create index idx_family_support_school
  on family_support_suggestions(school_id);

-- Updated-at trigger (reuses the set_updated_at function from 001)
create trigger trg_family_support_updated_at
  before update on family_support_suggestions
  for each row execute function set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table family_support_suggestions enable row level security;

-- Parents can SELECT suggestions for their linked students
create policy "family_support_select_parent"
  on family_support_suggestions for select
  using (
    auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Parents can INSERT (trigger generation) for their linked students
create policy "family_support_insert_parent"
  on family_support_suggestions for insert
  with check (
    school_id = auth_school_id()
    and auth_role() = 'parent'
    and student_id in (
      select student_id from parent_students where parent_id = auth.uid()
    )
  );

-- Educators can SELECT for students in their classrooms
create policy "family_support_select_educator"
  on family_support_suggestions for select
  using (
    auth_role() = 'educator'
    and student_id in (
      select s.id from students s
      where s.classroom_id in (
        select classroom_id from educator_classrooms where educator_id = auth.uid()
      )
    )
  );

-- Educators can INSERT for students in their classrooms
create policy "family_support_insert_educator"
  on family_support_suggestions for insert
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

-- Educators can UPDATE (to add educator_notes) for students in their classrooms
create policy "family_support_update_educator"
  on family_support_suggestions for update
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

-- Admins get full access for their school
create policy "family_support_select_admin"
  on family_support_suggestions for select
  using (school_id = auth_school_id() and auth_role() = 'admin');

create policy "family_support_insert_admin"
  on family_support_suggestions for insert
  with check (school_id = auth_school_id() and auth_role() = 'admin');

create policy "family_support_update_admin"
  on family_support_suggestions for update
  using (school_id = auth_school_id() and auth_role() = 'admin')
  with check (school_id = auth_school_id());

create policy "family_support_delete_admin"
  on family_support_suggestions for delete
  using (school_id = auth_school_id() and auth_role() = 'admin');
