-- 033_assignment_templates.sql
-- Assignment templates: reusable blueprints that educators can save to a
-- school-wide library and use to quickly create new assignments.

-- ============================================================
-- Table
-- ============================================================

create table if not exists assignment_templates (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references schools(id) on delete cascade,
  created_by      uuid references profiles(id) on delete set null,
  title           text not null,
  description     text,
  assignment_type text not null default 'class'
                  check (assignment_type in ('class', 'individual')),
  competency_ids  jsonb not null default '[]'::jsonb,   -- array of competency UUIDs
  skill_ids       jsonb not null default '[]'::jsonb,   -- array of skill UUIDs
  is_shared       boolean not null default true,        -- visible to all school staff
  template_data   jsonb not null default '{}'::jsonb,   -- extensible metadata (PBL milestones, etc.)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_assignment_templates_school on assignment_templates(school_id);
create index idx_assignment_templates_created_by on assignment_templates(created_by);

-- ============================================================
-- Updated_at trigger
-- ============================================================

create trigger set_assignment_templates_updated_at
  before update on assignment_templates
  for each row execute function set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

alter table assignment_templates enable row level security;

-- School members can read shared templates (or their own private ones)
create policy "assignment_templates_select"
  on assignment_templates for select
  using (
    school_id in (select school_id from profiles where id = auth.uid())
    and (is_shared = true or created_by = auth.uid())
  );

-- Educators and admins can insert
create policy "assignment_templates_insert"
  on assignment_templates for insert
  with check (
    school_id in (select school_id from profiles where id = auth.uid())
    and exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('educator', 'admin')
    )
  );

-- Creator or admin can update
create policy "assignment_templates_update"
  on assignment_templates for update
  using (
    school_id in (select school_id from profiles where id = auth.uid())
    and (
      created_by = auth.uid()
      or exists (
        select 1 from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

-- Creator or admin can delete
create policy "assignment_templates_delete"
  on assignment_templates for delete
  using (
    school_id in (select school_id from profiles where id = auth.uid())
    and (
      created_by = auth.uid()
      or exists (
        select 1 from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );
