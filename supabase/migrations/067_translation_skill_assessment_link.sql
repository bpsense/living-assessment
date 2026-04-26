-- 067_translation_skill_assessment_link.sql
-- Phase 6 — link translation mappings to V2 skill_assessments.
--
-- Migration 055 created translation_mappings with two source columns:
--   * competency_score_id        (V1: graded competency)
--   * student_skill_assignment_id (V1: legacy_student_skill_assignments was renamed in 066)
--
-- The V2 unified pipeline introduces `skill_assessments` (Phase 4). A mapping
-- should reference the assessment that produced the level being translated.
-- We add a third source column rather than renaming, so V1 historical mappings
-- keep resolving and the spec's "regeneratable after new assessments are
-- added" property is preserved.

alter table translation_mappings
  add column if not exists skill_assessment_id uuid
    references skill_assessments(id) on delete set null;

create index if not exists idx_translation_mappings_skill_assessment
  on translation_mappings(skill_assessment_id)
  where skill_assessment_id is not null;
