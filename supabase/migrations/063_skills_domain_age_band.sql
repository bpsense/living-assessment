-- 063_skills_domain_age_band.sql
-- Phase 2 of the V2 refactor: tag skills to a Learner Profile domain and an
-- optional age band, and allow a skill to be system-owned (school_id NULL =
-- baseline skill visible to every school).
--
-- This migration is additive — existing columns remain (progression_domain,
-- progression_strand, min_grade, max_grade, etc.) so the assignment system,
-- amoeba, and export keep working unchanged.

-- ============================================================
-- Schema changes
-- ============================================================

-- New columns
alter table skills
  add column if not exists domain_id      uuid references learner_profile_domains(id) on delete set null,
  add column if not exists age_band_start integer,
  add column if not exists age_band_end   integer;

-- Allow system-owned baseline skills: school_id becomes NULLABLE.
-- (FK + on-delete behavior is unchanged.)
alter table skills alter column school_id drop not null;

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_skills_domain     on skills(domain_id);
create index if not exists idx_skills_age_band   on skills(age_band_start, age_band_end);
create index if not exists idx_skills_baseline   on skills(school_id) where school_id is null;

-- ============================================================
-- RLS
-- ============================================================

-- The existing policies hard-coded `school_id IN (... user's schools)`, which
-- silently excludes baseline (school_id IS NULL) skills. Replace them so
-- baseline skills are readable by everyone, while writes still require either
-- a school admin/educator (own school, school-owned skill) or a system admin.

drop policy if exists "skills_select" on skills;
drop policy if exists "skills_insert" on skills;
drop policy if exists "skills_update" on skills;
drop policy if exists "skills_delete" on skills;

create policy "skills_select"
  on skills for select to authenticated
  using (
    school_id is null
    or school_id in (select school_id from profiles where id = auth.uid())
    or is_system_admin()
  );

create policy "skills_insert"
  on skills for insert to authenticated
  with check (
    -- System admins can insert anywhere, including baseline (school_id NULL)
    is_system_admin()
    -- Otherwise educators/admins can only insert school-owned skills for
    -- their own school. They cannot create baseline rows.
    or (
      school_id is not null
      and school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "skills_update"
  on skills for update to authenticated
  using (
    is_system_admin()
    or (
      school_id is not null
      and school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  )
  with check (
    is_system_admin()
    or (
      school_id is not null
      and school_id in (
        select school_id from profiles
        where id = auth.uid() and role in ('admin', 'educator')
      )
    )
  );

create policy "skills_delete"
  on skills for delete to authenticated
  using (
    is_system_admin()
    or (
      school_id is not null
      and (
        school_id in (
          select school_id from profiles
          where id = auth.uid() and role = 'admin'
        )
        or created_by = auth.uid()
      )
    )
  );
