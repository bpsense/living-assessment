-- 078_drop_legacy_skill_and_assignment_tables.sql
-- Phase 4 of the standards-driven assignment refactor.
--
-- Drops the legacy join tables that no application code references after
-- the cutover. The pre-live posture (sample data only) means we don't
-- need data preservation.
--
-- Conservative scope: only drops tables with no incoming foreign keys
-- and zero remaining src/ references. Tables tangled in the FK graph
-- (skills, student_skill_assignments, skill_progression_steps,
-- assignment_templates, legacy_*) will be retired in a follow-up
-- once their downstream consumers (Translate, competency_scores,
-- translation_mappings, assignments.template_id) are also cut over.

drop table if exists assignment_competencies cascade;
drop table if exists assignment_skills       cascade;
drop table if exists skill_competencies      cascade;
