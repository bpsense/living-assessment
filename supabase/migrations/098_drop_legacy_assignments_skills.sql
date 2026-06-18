-- 098_drop_legacy_assignments_skills.sql
--
-- Full teardown of the legacy assignment, standards-grading, and skills
-- subsystems, clearing the ground for a from-scratch rebuild of "assignments".
--
-- Scope (confirmed with product owner):
--   * Assignment core + standards-grading tables (8)
--   * Skills subsystem tables (6) + skill-seeding functions/trigger
--   * competency_scores — its only data source was assignment grading; the
--     amoeba is observation-driven, so app scoring falls back cleanly
--   * assignment-linking columns on the kept observations table
--   * assignment-only DB functions + now-orphaned enum types
--   * assignment-files storage bucket (0 objects)
--
-- NOT touched: observations, competencies/dimensions, competency_dimension_mappings,
-- compute_all_competency_scores / compile_student_context_internal (observation-based),
-- and the dormant Translate feature (translation_mappings) — its foreign keys into the
-- dropped tables are cleared by CASCADE; the table itself is left for a separate decision.
--
-- Pre-rebuild posture: sample/seed data only — no preservation required.

-- ----------------------------------------------------------------
-- 1. Assignment-only / skill-seeding functions & triggers.
--    CASCADE on trigger_seed_default_skills() drops the
--    seed_skills_on_school_create trigger on schools.
-- ----------------------------------------------------------------
drop function if exists public.learner_visible_assignment_ids() cascade;
drop function if exists public.snapshot_assignment_standards_on_assign() cascade;
drop function if exists public.trigger_seed_default_skills() cascade;
drop function if exists public.seed_default_skills(uuid) cascade;

-- ----------------------------------------------------------------
-- 2. Assignment-linking columns on the kept observations table.
-- ----------------------------------------------------------------
alter table public.observations drop column if exists assignment_id;
alter table public.observations drop column if exists student_assignment_id;

-- ----------------------------------------------------------------
-- 3. competency_scores (assignment-sourced; amoeba is observation-driven).
--    CASCADE clears translation_mappings.competency_score_id FK.
-- ----------------------------------------------------------------
drop table if exists public.competency_scores cascade;

-- ----------------------------------------------------------------
-- 4. Skills subsystem (children first; CASCADE clears translation_mappings
--    FKs into skill_assessments / legacy_student_skill_assignments).
-- ----------------------------------------------------------------
drop table if exists public.skill_assessments               cascade;
drop table if exists public.legacy_student_skill_assignments cascade;
drop table if exists public.legacy_skill_assignments         cascade;
drop table if exists public.student_skill_assignments        cascade;
drop table if exists public.skill_progression_steps          cascade;
drop table if exists public.skills                           cascade;

-- ----------------------------------------------------------------
-- 5. Assignment core + standards-grading (children first).
-- ----------------------------------------------------------------
drop table if exists public.assessment_attachments           cascade;
drop table if exists public.assignment_standard_assessments  cascade;
drop table if exists public.assignment_standards             cascade;
drop table if exists public.student_assignment_standards     cascade;
drop table if exists public.assignment_attachments           cascade;
drop table if exists public.student_assignments              cascade;
drop table if exists public.assignments                      cascade;
drop table if exists public.assignment_templates             cascade;

-- ----------------------------------------------------------------
-- 6. Enum types orphaned by the table drops.
-- ----------------------------------------------------------------
drop type if exists public.assessment_level;
drop type if exists public.assignment_status;
drop type if exists public.assignment_type;
drop type if exists public.student_assignment_status;
drop type if exists public.learner_column;
drop type if exists public.competency_score_source;

-- ----------------------------------------------------------------
-- 7. The empty `assignment-files` storage bucket (0 objects) is removed
--    out-of-band via the Storage API / dashboard — Supabase blocks direct
--    DELETE on storage.buckets from SQL (storage.protect_delete guard).
-- ----------------------------------------------------------------
