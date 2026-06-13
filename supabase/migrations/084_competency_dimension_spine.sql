-- 084_competency_dimension_spine.sql
-- Reshapes the assessment model around a single, flat, school-authored spine:
--   Dimension (the "Boundless 8") -> Competency -> Observation.
--
-- Source of truth for default content: supabase/seed/boundless_framework.json
-- (extracted from "Boundless Competencies and Standards.xlsx"). Seeding of the 73
-- default competencies is done by scripts/seed-boundless-framework.ts, NOT here --
-- this migration only creates the fields the framework + builder need.
--
-- Design decisions baked in here:
--   * Dimension is the top of the spine and gains the framework's descriptive
--     attributes (strand / learner_profile / area_of_development). Its `name` holds
--     the action phrase, e.g. "Think Deeply".
--   * The framework is FLAT: a competency hangs directly off a dimension. The
--     mid-level "Standard" grouping from the spreadsheet is kept only as a text
--     label (`standard_label`) on the competency, not its own table.
--   * Competencies become school-scoped directly (`school_id`) and dimension-linked
--     (`dimension_id`); the legacy framework/domain/subdomain linkage is made
--     optional so the dormant Common-Core seed can coexist until it is replaced.
--   * Observations can name the specific competency assessed (`competency_id`,
--     nullable -- existing observations stay valid, dimension-only).
--
-- All changes are additive / non-destructive. Nothing deletes or rewrites the
-- ~12k existing observations or the standards-assessment data.

-- ============================================================
-- 1. Dimensions gain the framework's descriptive attributes
-- ============================================================

alter table dimensions
  add column if not exists strand              text,   -- 'Academic' | 'Social-Emotional'
  add column if not exists learner_profile     text,   -- e.g. 'Thinker'
  add column if not exists area_of_development text;    -- e.g. 'Scientific Thinking & Inquiry'

-- ============================================================
-- 2. Competencies: flat, school-scoped, dimension-linked
-- ============================================================

alter table competencies
  add column if not exists school_id      uuid references schools(id)    on delete cascade,
  add column if not exists dimension_id   uuid references dimensions(id) on delete set null,
  add column if not exists standard_label text,
  add column if not exists display_order  integer not null default 0;

-- Legacy framework linkage is now optional (Boundless rows won't use it).
alter table competencies alter column framework_id drop not null;
alter table competencies alter column subdomain_id drop not null;
alter table competencies alter column code         drop not null;

-- Backfill school_id for the existing framework-linked competencies so the new
-- school_id-based RLS (below) keeps them visible.
update competencies c
   set school_id = cf.school_id
  from competency_frameworks cf
 where c.framework_id = cf.id
   and c.school_id is null;

create index if not exists idx_competencies_school    on competencies(school_id);
create index if not exists idx_competencies_dimension on competencies(dimension_id);

-- ============================================================
-- 3. Observations can name the competency assessed
-- ============================================================

alter table observations
  add column if not exists competency_id uuid references competencies(id) on delete set null;

create index if not exists idx_observations_competency on observations(competency_id);

-- ============================================================
-- 4. RLS — re-key competencies policies onto school_id
-- ============================================================
-- The old policies keyed off framework_id; new dimension-linked rows have a NULL
-- framework_id and would be invisible. Re-key onto the new school_id column.

drop policy if exists "competencies_select" on competencies;
drop policy if exists "competencies_insert" on competencies;
drop policy if exists "competencies_update" on competencies;
drop policy if exists "competencies_delete" on competencies;

create policy "competencies_select"
  on competencies for select to authenticated
  using (
    school_id in (select school_id from profiles where id = auth.uid())
  );

create policy "competencies_insert"
  on competencies for insert to authenticated
  with check (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "competencies_update"
  on competencies for update to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role in ('admin', 'educator')
    )
  );

create policy "competencies_delete"
  on competencies for delete to authenticated
  using (
    school_id in (
      select school_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
