-- 062_learner_profiles.sql
-- Phase 1 of the V2 refactor: Learner Profile becomes the primary assessment
-- framework. A Learner Profile is a school-owned set of competency domains
-- that drives the amoeba visualization (skills tagged to domains arrive in
-- a later phase).
--
-- Each school gets a system-managed "default" profile (is_default=true) that
-- non-system-admins can read but not edit. School admins customize by cloning
-- the default into an editable working profile (is_default=false). The school's
-- "active" profile is the one currently driving visualizations.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists learner_profiles (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  description text,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists learner_profile_domains (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references learner_profiles(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_learner_profiles_school on learner_profiles(school_id);
create index if not exists idx_learner_profiles_active on learner_profiles(school_id, is_active);
create index if not exists idx_learner_profiles_default on learner_profiles(school_id, is_default);
create index if not exists idx_learner_profile_domains_profile on learner_profile_domains(profile_id);
create index if not exists idx_learner_profile_domains_sort on learner_profile_domains(profile_id, sort_order);

-- One default profile per school
create unique index if not exists uq_learner_profiles_one_default_per_school
  on learner_profiles(school_id) where is_default = true;

-- ============================================================
-- Triggers
-- ============================================================

create trigger set_learner_profiles_updated_at
  before update on learner_profiles
  for each row execute function set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

alter table learner_profiles enable row level security;
alter table learner_profile_domains enable row level security;

-- ---- learner_profiles ----

-- Read: any user in the same school (or system admin)
create policy "learner_profiles_select"
  on learner_profiles for select to authenticated
  using (
    school_id in (select school_id from profiles where id = auth.uid())
    or is_system_admin()
  );

-- Insert: school admins (for their school) or system admins
create policy "learner_profiles_insert"
  on learner_profiles for insert to authenticated
  with check (
    is_system_admin()
    or (
      school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
      and is_default = false
    )
  );

-- Update: school admins for their non-default profiles; system admins anywhere
create policy "learner_profiles_update"
  on learner_profiles for update to authenticated
  using (
    is_system_admin()
    or (
      is_default = false
      and school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  )
  with check (
    is_system_admin()
    or (
      is_default = false
      and school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

-- Delete: school admins for their non-default profiles; system admins anywhere
create policy "learner_profiles_delete"
  on learner_profiles for delete to authenticated
  using (
    is_system_admin()
    or (
      is_default = false
      and school_id in (
        select school_id from profiles
        where id = auth.uid() and role = 'admin'
      )
    )
  );

-- ---- learner_profile_domains ----

-- Read: anyone who can read the parent profile
create policy "learner_profile_domains_select"
  on learner_profile_domains for select to authenticated
  using (
    profile_id in (
      select id from learner_profiles
      where school_id in (select school_id from profiles where id = auth.uid())
    )
    or is_system_admin()
  );

create policy "learner_profile_domains_insert"
  on learner_profile_domains for insert to authenticated
  with check (
    is_system_admin()
    or profile_id in (
      select lp.id from learner_profiles lp
      where lp.is_default = false
        and lp.school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

create policy "learner_profile_domains_update"
  on learner_profile_domains for update to authenticated
  using (
    is_system_admin()
    or profile_id in (
      select lp.id from learner_profiles lp
      where lp.is_default = false
        and lp.school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  )
  with check (
    is_system_admin()
    or profile_id in (
      select lp.id from learner_profiles lp
      where lp.is_default = false
        and lp.school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

create policy "learner_profile_domains_delete"
  on learner_profile_domains for delete to authenticated
  using (
    is_system_admin()
    or profile_id in (
      select lp.id from learner_profiles lp
      where lp.is_default = false
        and lp.school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
    )
  );

-- ============================================================
-- Default template seeding
-- ============================================================
--
-- DEFAULT_LEARNER_PROFILE_DOMAINS — keep in sync with the constant in
-- src/lib/learner-profile-data.ts so server-side reseeds and client-side
-- "Reset to Default" produce identical content.

create or replace function seed_default_learner_profile(p_school_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id
    from learner_profiles
    where school_id = p_school_id and is_default = true
    limit 1;

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  insert into learner_profiles (school_id, name, description, is_default, is_active)
  values (
    p_school_id,
    'Default Learner Profile',
    'Eight cross-cutting domains describing a whole-child portrait. School admins can clone this template to create an editable, school-owned version.',
    true,
    true
  )
  returning id into v_profile_id;

  insert into learner_profile_domains (profile_id, name, description, color, sort_order) values
    (v_profile_id, 'Language & Communication',
      'Reading, writing, speaking, listening, and multimodal expression across languages and contexts.',
      '#0EA5E9', 0),
    (v_profile_id, 'Mathematical Thinking',
      'Number sense, reasoning with quantity and pattern, problem solving, and modelling the world mathematically.',
      '#6366F1', 1),
    (v_profile_id, 'Scientific & Environmental Inquiry',
      'Observation, hypothesis, evidence, and the dispositions of a curious investigator of natural and built systems.',
      '#10B981', 2),
    (v_profile_id, 'Creative Expression & Making',
      'Visual art, music, performance, design, and craft — generating ideas and bringing them into the world.',
      '#F59E0B', 3),
    (v_profile_id, 'Inner Self & Well Being',
      'Self-awareness, emotional regulation, identity, agency, and the capacity to flourish.',
      '#EC4899', 4),
    (v_profile_id, 'Physical Wellbeing & Movement',
      'Gross and fine motor development, body awareness, healthy habits, and physical confidence.',
      '#EF4444', 5),
    (v_profile_id, 'Collaboration & Relational Skills',
      'Listening, perspective-taking, conflict navigation, and contributing to shared work with care.',
      '#8B5CF6', 6),
    (v_profile_id, 'Global Citizenship & Contribution',
      'Curiosity about cultures and systems, ethical reasoning, and the impulse to act for the common good.',
      '#14B8A6', 7);

  return v_profile_id;
end;
$$;

-- Auto-seed on new school creation
create or replace function trigger_seed_default_learner_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  perform seed_default_learner_profile(new.id);
  return new;
end;
$$;

create trigger seed_learner_profile_on_school_create
  after insert on schools
  for each row
  execute function trigger_seed_default_learner_profile();

-- Backfill existing schools
do $$
declare
  r record;
begin
  for r in
    select s.id from schools s
    where not exists (
      select 1 from learner_profiles lp
      where lp.school_id = s.id and lp.is_default = true
    )
  loop
    perform seed_default_learner_profile(r.id);
  end loop;
end;
$$;
